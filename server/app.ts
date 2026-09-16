import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes.js";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { assertDatabaseConfigured, pool, db } from "./db.js";
import { sql } from "drizzle-orm";
import { pollPendingCryptoPayments } from "./crypto-poller.js";
import { startTelegramBot } from "./telegram.js";
import { log } from "./logger.js";
import { ensureVouchSchema } from "./vouches.js";
import { ensureTelegramReferralSchema } from "./telegram-referrals.js";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export interface AppInitializationOptions {
  startBackgroundJobs?: boolean;
}

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "https://js.authorize.net", "https://jstest.authorize.net"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "https://api2.authorize.net", "https://apitest.authorize.net"],
        upgradeInsecureRequests: [],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
    next();
  });

  app.use(
    express.json({
      limit: "6mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "6mb" }));

  function removeSensitiveFields(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(removeSensitiveFields);
    if (!value || typeof value !== "object") return value;

    const hidden = new Set(["password", "loginCode", "smtp_password", "smtpPassword"]);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !hidden.has(key))
        .map(([key, nested]) => [key, removeSensitiveFields(nested)]),
    );
  }

  // Password hashes, legacy login codes, and stored mail credentials must never
  // be returned accidentally by an API handler.
  app.use((_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => originalJson(removeSensitiveFields(body))) as typeof res.json;
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });

  return { app, httpServer };
}

export async function initializeApp(
  app: express.Express,
  httpServer: Server,
  options: AppInitializationOptions = {},
) {
  const { startBackgroundJobs = true } = options;

  assertDatabaseConfigured();

  // Ensure the session table exists (connect-pg-simple needs this).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
  await pool.query(`ALTER TABLE "crypto_payments" ADD COLUMN IF NOT EXISTS "settled_at" timestamp`);
  await ensureVouchSchema();
  await ensureTelegramReferralSchema();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

    console.error("Internal Server Error:", err instanceof Error ? err.message : err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Seed default site settings (idempotent — only sets if not already present).
  try {
    await db.execute(sql`
      INSERT INTO site_settings (key, value) VALUES
        ('cashapp_tag',            '$Jacobgettinmotionx'),
        ('payment_method_cashapp', 'true'),
        ('payment_method_chime',   'false'),
        ('payment_method_zelle',   'false'),
        ('payment_method_crypto',  'true')
      ON CONFLICT (key) DO NOTHING
    `);
    log("Site settings seed complete");
  } catch (e) {
    console.error("Site settings seed failed:", e);
  }

  // Vercel functions are short-lived and may scale horizontally, so long-running
  // cleanup, payment polling, and Telegram polling stay disabled there.
  if (!startBackgroundJobs) return;

  const cancelStaleOrders = async () => {
    try {
      const cancelled = await storage.cancelStalePendingOrders(60 * 60 * 1000);
      if (cancelled > 0) {
        log(`Cancelled ${cancelled} stale pending order(s) older than 1 hour`);
      }
    } catch (err) {
      console.error("Error in stale order cleanup job:", err);
    }
  };
  cancelStaleOrders();
  setInterval(cancelStaleOrders, 5 * 60 * 1000);

  const expireStaleCrypto = async () => {
    try {
      const expired = await storage.expireStaleCryptoPayments(2 * 60 * 60 * 1000);
      if (expired > 0) {
        log(`Expired ${expired} stale crypto payment(s) older than 2 hours`);
      }
    } catch (err) {
      console.error("Error in crypto expiry job:", err);
    }
  };
  expireStaleCrypto();
  setInterval(expireStaleCrypto, 5 * 60 * 1000);

  pollPendingCryptoPayments();
  setInterval(pollPendingCryptoPayments, 30 * 1000);

  // Telegram permits only one long-polling consumer per bot token. Keep the
  // preview process from competing with the published production bot.
  if (process.env.NODE_ENV === "production") {
    startTelegramBot();
  } else {
    log("Telegram polling disabled in development; use the published bot", "telegram");
  }
}