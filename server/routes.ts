import express, { type Express } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage.js";
import { setupAuth, MIN_PASSWORD_LENGTH, passwordChangeLimiter } from "./auth.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { createNowPaymentsInvoice, getNowPaymentsInvoice, mapNowPaymentsStatus, verifyNowPaymentsWebhook } from "./nowpayments.js";
import { settleCryptoPayment } from "./crypto-settlement.js";
import { hashPassword, comparePassword } from "./auth.js";
import { cryptoPayments, orders, orderItems, verifications, variants, userIps, users, mails, mailReads, discountCodes, transactions, stockItems, cards, cardBases, achs, products, insertAnnouncementSchema } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { MAX_LICENSE_FILE_BYTES, parseLicenseKeyFile } from "./license-key-file.js";
import { formatOrdersAsText } from "./order-export.js";
import {
  approveVouch,
  bindVouchToken,
  createVouchToken,
  getRecentVouches,
  getTelegramBotUrl,
  getVouchStats,
  getVouchStatusesForOrders,
  rejectVouch,
  submitTelegramVouch,
  VouchError,
} from "./vouches.js";
function isAdminOrWorker(req: any): boolean {
  const u = req.user as any;
  return req.isAuthenticated() && (u?.role === "admin" || u?.isWorker === true);
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated?.() || req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    res.on("finish", () => {
      console.info(`[security] admin action user=${req.user.id} method=${req.method} path=${req.path} status=${res.statusCode}`);
    });
  }
  next();
}

function requireInternalApi(req: any, res: any, next: any) {
  const configuredKey = process.env.SITE_API_KEY ?? process.env.APP_ENCRYPTION_KEY;
  const suppliedKey = String(req.get("x-site-api-key") ?? req.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!configuredKey || suppliedKey.length !== configuredKey.length ||
      !timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(configuredKey))) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function vouchErrorResponse(error: unknown, res: any) {
  if (error instanceof VouchError) {
    const status = error.code === "NOT_FOUND" ? 404
      : ["INVALID_TOKEN", "INELIGIBLE", "ALREADY_SUBMITTED", "DUPLICATE_IMAGE", "ALREADY_REVIEWED", "ORDER_REWARDED", "ALREADY_REWARDED"].includes(error.code) ? 409
      : 400;
    return res.status(status).json({ message: error.message, code: error.code });
  }
  console.error("[vouch] request failed:", error instanceof Error ? error.message : error);
  return res.status(500).json({ message: "Unable to process the vouch right now." });
}

// BIN lookup cache + throttle queue (binlist.net = ~10 req/min free tier)
const binCache = new Map<string, any>();
const binQueue: Array<{ bin: string; resolve: (v: any) => void }> = [];
let binQueueRunning = false;
function processBinQueue() {
  if (binQueueRunning || binQueue.length === 0) return;
  binQueueRunning = true;
  const { bin, resolve } = binQueue.shift()!;
  fetch(`https://lookup.binlist.net/${bin}`, { headers: { "Accept-Version": "3" } })
    .then(async r => {
      if (!r.ok) { resolve({ bin }); return; }
      const data = await r.json() as any;
      const result = {
        bin,
        bank: data.bank?.name ?? null,
        scheme: data.scheme ?? null,
        type: data.type ?? null,
        brand: data.brand ?? null,
        country: data.country?.name ?? null,
        countryCode: data.country?.alpha2 ?? null,
      };
      binCache.set(bin, result);
      resolve(result);
    })
    .catch(() => resolve({ bin }))
    .finally(() => {
      setTimeout(() => { binQueueRunning = false; processBinQueue(); }, 700);
    });
}
function lookupBin(bin: string): Promise<any> {
  if (binCache.has(bin)) return Promise.resolve(binCache.get(bin));
  return new Promise(resolve => { binQueue.push({ bin, resolve }); processBinQueue(); });
}

const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many game requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const walletLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many wallet requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const vouchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many vouch link requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith("/api"),
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  message: { message: "Too many administrative requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const imageSignatures: Array<{ mimeType: string; extension: string; matches: (data: Buffer) => boolean }> = [
  { mimeType: "image/png", extension: "png", matches: (data) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: "image/jpeg", extension: "jpg", matches: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mimeType: "image/webp", extension: "webp", matches: (data) => data.length >= 12 && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP" },
];

function validateImageUpload(data: unknown) {
  if (typeof data !== "string" || data.length === 0) return null;
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
  const matched = imageSignatures.find((image) => image.matches(buffer));
  if (!matched) return null;
  return { data: buffer.toString("base64"), ...matched };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.set('etag', false);
  app.use('/api', apiLimiter);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  // Auth setup (handles /api/login, /api/register, /api/logout, /api/user)
  setupAuth(app);

  // Keep the admin rate limit, but let each endpoint apply its own access rule.
  // Some worker dashboard endpoints intentionally live under /api/admin for
  // backwards compatibility and use isAdminOrWorker instead.
  app.use("/api/admin", adminLimiter);

  // Public announcements
  app.get("/api/announcements", async (req, res) => {
    const all = await storage.getAnnouncements();
    const bannerColor = await storage.getSetting("announcement_banner_color", "#5a0000");
    res.json(all.map((announcement) => ({ ...announcement, bannerColor })));
  });

  // Products
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  // Top selling products in the past hour
  app.get("/api/products/top-selling", async (req, res) => {
    try {
      const queryTop = async (windowMs: number | null) => {
        const base = db
          .select({
            productId: variants.productId,
            salesCount: sql<number>`cast(sum(${orderItems.quantity}) as int)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .innerJoin(variants, eq(orderItems.variantId, variants.id));

        const q = windowMs
          ? base.where(and(
              sql`${orders.createdAt} >= ${new Date(Date.now() - windowMs)}`,
              sql`${orders.status} in ('fulfilled','delivering')`
            ))
          : base.where(sql`${orders.status} in ('fulfilled','delivering')`);

        return q.groupBy(variants.productId).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(2);
      };

      // Try 1h → 24h → all-time so top 2 are always shown
      let rows = await queryTop(60 * 60 * 1000);
      if (rows.length < 2) rows = await queryTop(24 * 60 * 60 * 1000);
      if (rows.length < 2) rows = await queryTop(null);
      if (rows.length === 0) return res.json([]);

      const allProducts = await storage.getProducts();
      const result = rows
        .map((r) => {
          const product = allProducts.find((p: any) => p.id === r.productId);
          if (!product) return null;
          return { ...product, salesCount: r.salesCount };
        })
        .filter(Boolean);

      res.json(result);
    } catch (err) {
      console.error("top-selling error:", err);
      res.json([]);
    }
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post(api.products.create.path, async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const product = await storage.createProduct(req.body);
    res.status(201).json(product);
  });

  // Variants
  app.post(api.variants.create.path, async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const variant = await storage.createVariant(req.body);
    res.status(201).json(variant);
  });

  // Stock
  app.post(api.stock.add.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const sellerId = req.body.sellerId ? Number(req.body.sellerId) : undefined;
    const count = await storage.addStockItems(req.body.variantId, req.body.rawContent, sellerId);
    res.json({ addedCount: count.added });
  });

  // Orders
  app.post(api.orders.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = (req.user as any).id;
      const { items, cardIds, discountCodeId, sellerId } = req.body;
      const productItems = (items || []).filter((i: any) => !i.cardId && i.variantId > 0)
        .map((i: any) => ({ ...i, sellerId: sellerId || i.sellerId || undefined }));
      const cardIdList: number[] = cardIds || [];

      const order = await storage.createOrder(userId, productItems, cardIdList, discountCodeId ?? null);
      res.status(201).json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get(api.orders.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const orders = await storage.getOrders((req.user as any).id);
    const statuses = await getVouchStatusesForOrders((req.user as any).id);
    const latestByOrder = new Map<number, typeof statuses[number]>();
    for (const status of statuses) {
      if (!latestByOrder.has(status.orderId)) latestByOrder.set(status.orderId, status);
    }
    res.json(orders.map((order: any) => ({
      ...order,
      vouchStatus: latestByOrder.get(order.id)?.status ?? null,
      vouchRewardAmount: latestByOrder.get(order.id)?.rewardAmount ?? null,
      vouchReviewedAt: latestByOrder.get(order.id)?.reviewedAt ?? null,
    })));
  });

  app.get("/api/orders/export", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const orders = await storage.getOrders((req.user as any).id);
      const date = new Date().toISOString().slice(0, 10);
      res
        .status(200)
        .set({
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="orders-${date}.txt"`,
          "Cache-Control": "no-store",
        })
        .send(formatOrdersAsText(orders));
    } catch (error) {
      console.error("[orders] export failed:", error);
      res.status(500).json({ message: "Unable to export orders right now." });
    }
  });

  app.get(api.orders.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const order = await storage.getOrder(Number(req.params.id));
    if (!order || order.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  });

  // Telegram image vouches. Eligibility and reward values are always decided here.
  app.post("/api/vouches/create-token", vouchLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const orderId = Number(req.body?.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ message: "Invalid order." });
      const created = await createVouchToken((req.user as any).id, orderId);
      const botUrl = await getTelegramBotUrl();
      res.json({
        telegramUrl: `${botUrl}?start=${encodeURIComponent(created.token)}`,
        expiresAt: created.expiresAt,
        rewardAmount: 50,
      });
    } catch (error) {
      return vouchErrorResponse(error, res);
    }
  });

  app.get("/api/vouches/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const statuses = await getVouchStatusesForOrders((req.user as any).id);
    res.json(statuses);
  });

  // These endpoints are for a separately hosted bot or operational tooling.
  // The in-process bot uses the same service functions directly.
  app.post("/api/internal/vouches/validate-token", requireInternalApi, async (req, res) => {
    try {
      const result = await bindVouchToken(
        String(req.body?.token ?? ""),
        String(req.body?.telegramChatId ?? ""),
        String(req.body?.telegramUserId ?? ""),
        req.body?.telegramUsername ? String(req.body.telegramUsername) : null,
      );
      res.json({ valid: true, orderNumber: result.orderNumber, rewardAmount: result.rewardAmount, expiresAt: result.expiresAt });
    } catch (error) {
      return vouchErrorResponse(error, res);
    }
  });

  app.post("/api/internal/vouches/submit", requireInternalApi, async (req, res) => {
    try {
      const imageHash = String(req.body?.imageHash ?? "");
      if (!/^[a-f0-9]{64}$/.test(imageHash)) return res.status(400).json({ message: "Invalid image hash." });
      const vouch = await submitTelegramVouch({
        telegramChatId: String(req.body?.telegramChatId ?? ""),
        telegramUserId: String(req.body?.telegramUserId ?? ""),
        telegramUsername: req.body?.telegramUsername ? String(req.body.telegramUsername) : null,
        telegramFileId: String(req.body?.telegramFileId ?? ""),
        imageHash,
      });
      res.status(201).json({ id: vouch.id, status: vouch.status, orderId: vouch.order_id, rewardAmount: vouch.reward_amount });
    } catch (error) {
      return vouchErrorResponse(error, res);
    }
  });

  app.post("/api/internal/vouches/:id/approve", requireInternalApi, async (req, res) => {
    try {
      const adminId = String(req.body?.adminId ?? "");
      if (!adminId) return res.status(403).json({ message: "Admin identity is required." });
      const result = await approveVouch(Number(req.params.id), adminId);
      res.json({ id: result.vouch.id, status: result.vouch.status, rewardAmount: result.rewardAmount });
    } catch (error) {
      return vouchErrorResponse(error, res);
    }
  });

  app.post("/api/internal/vouches/:id/reject", requireInternalApi, async (req, res) => {
    try {
      const adminId = String(req.body?.adminId ?? "");
      if (!adminId) return res.status(403).json({ message: "Admin identity is required." });
      const result = await rejectVouch(Number(req.params.id), adminId, req.body?.reason);
      res.json({ id: result.vouch.id, status: result.vouch.status });
    } catch (error) {
      return vouchErrorResponse(error, res);
    }
  });

  app.get("/api/internal/vouches/stats", requireInternalApi, async (_req, res) => {
    res.json(await getVouchStats());
  });

  app.get("/api/internal/vouches/recent", requireInternalApi, async (req, res) => {
    res.json(await getRecentVouches(Number(req.query.limit) || 10));
  });

  // Wallet & Redeem
  app.post(api.wallet.redeem.path, walletLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const codeValue = String(req.body?.code ?? "").trim().toUpperCase();
    const code = await storage.getRedeemCode(codeValue);
    
    if (!code || code.isUsed) {
      return res.status(400).json({ message: "Invalid or used code" });
    }

    const userId = (req.user as any).id;
    if (code.code.startsWith("GIFT-")) {
      return res.status(400).json({ message: "Telegram store-credit rewards are no longer available" });
    }

    const claimed = await storage.markRedeemCodeUsed(code.id, userId);
    if (!claimed) {
      return res.status(400).json({ message: "Invalid or used code" });
    }
    const updatedUser = await storage.updateUserBalance(userId, code.amount);
    await storage.createTransaction(userId, code.amount, "deposit", `Redeemed code: ${code.code}`);

    res.json({ newBalance: updatedUser.balance, amountAdded: code.amount });
  });

  app.get(api.wallet.transactions.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const txs = await storage.getTransactions((req.user as any).id);
    res.json(txs);
  });

  // Combined deposits list (crypto + cashapp deposits) for topup history
  app.get("/api/deposits", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    try {
      // Crypto deposit payments
      const cryptoRows = await db
        .select()
        .from(cryptoPayments)
        .where(and(eq(cryptoPayments.userId, userId), eq(cryptoPayments.purpose, "deposit")))
        .orderBy(desc(cryptoPayments.createdAt))
        .limit(30);

       // Manual deposit orders (CashApp, Venmo, Chime, Zelle)
      const cashappRows = await db
        .select()
        .from(orders)
        .where(and(eq(orders.userId, userId), sql`${orders.paymentMethod} IN ('CashApp','Venmo','Chime','Zelle')`))
        .orderBy(desc(orders.createdAt))
        .limit(30);

      // Filter cashapp orders that are deposit-only (no order items)
      const allOrderIds = cashappRows.map(o => o.id);
      let depositOnlyCashapp = cashappRows;
      if (allOrderIds.length > 0) {
        const itemsInOrders = await db
          .select({ orderId: orderItems.orderId })
          .from(orderItems)
          .where(sql`${orderItems.orderId} = ANY(ARRAY[${sql.join(allOrderIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
        const orderIdsWithItems = new Set(itemsInOrders.map(i => i.orderId));
        depositOnlyCashapp = cashappRows.filter(o => !orderIdsWithItems.has(o.id));
      }

      const cryptoDeposits = cryptoRows.map(p => ({
        id: `crypto_${p.id}`,
        type: "crypto" as const,
        amount: p.amount,
        status: p.status,
        paymentId: p.forebitPaymentId,
        checkoutUrl: p.checkoutUrl,
        createdAt: p.createdAt,
      }));

      const cashappDeposits = depositOnlyCashapp.map(o => ({
        id: `cashapp_${o.id}`,
         type: (o.paymentMethod?.toLowerCase() ?? "cashapp") as "cashapp" | "venmo" | "chime" | "zelle",
        amount: o.total,
        status: o.status,
        paymentNote: o.paymentNote,
        createdAt: o.createdAt,
      }));

      const all = [...cryptoDeposits, ...cashappDeposits].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(all);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: all deposits from all users
  app.get("/api/admin/deposits", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const cryptoRows = await db
        .select({
          id: cryptoPayments.id, userId: cryptoPayments.userId, amount: cryptoPayments.amount,
          status: cryptoPayments.status, createdAt: cryptoPayments.createdAt,
          username: users.username,
        })
        .from(cryptoPayments)
        .leftJoin(users, eq(cryptoPayments.userId, users.id))
        .where(eq(cryptoPayments.purpose, "deposit"))
        .orderBy(desc(cryptoPayments.createdAt))
        .limit(200);

      const cashappRows = await db
        .select({
          id: orders.id, userId: orders.userId, total: orders.total,
          status: orders.status, paymentNote: orders.paymentNote, createdAt: orders.createdAt,
          paymentMethod: orders.paymentMethod, username: users.username,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
         .where(sql`${orders.paymentMethod} IN ('CashApp','Venmo','Chime','Zelle')`)
        .orderBy(desc(orders.createdAt))
        .limit(200);

      const allOrderIds = cashappRows.map(o => o.id);
      let depositOnlyCashapp = cashappRows;
      if (allOrderIds.length > 0) {
        const itemsInOrders = await db
          .select({ orderId: orderItems.orderId })
          .from(orderItems)
          .where(sql`${orderItems.orderId} = ANY(ARRAY[${sql.join(allOrderIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
        const orderIdsWithItems = new Set(itemsInOrders.map(i => i.orderId));
        depositOnlyCashapp = cashappRows.filter(o => !orderIdsWithItems.has(o.id));
      }

      const result = [
        ...cryptoRows.map(p => ({
          id: `crypto_${p.id}`, type: "crypto", username: p.username ?? "?",
          amount: p.amount, status: p.status, createdAt: p.createdAt,
        })),
        ...depositOnlyCashapp.map(o => ({
          id: `cashapp_${o.id}`, type: o.paymentMethod?.toLowerCase() ?? "cashapp", username: o.username ?? "?",
          amount: o.total, status: o.status, paymentNote: o.paymentNote, createdAt: o.createdAt,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Games
  app.post(api.games.dice.path, gameLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const bet = Number(req.body.betAmount);

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ message: "Invalid bet amount." });
    }
    if (bet > 100000) {
      return res.status(400).json({ message: "Bet amount exceeds maximum allowed." });
    }
    if (user.balance < bet) return res.status(400).json({ message: "Insufficient balance" });

    // Deduct bet
    await storage.updateUserBalance(user.id, -bet);
    await storage.createTransaction(user.id, -bet, "loss", "Dice game bet");

    // Game Logic: Roll 2 dice (1-6). 
    // Spec: "Roll 2 dice vs system. Higher total wins."
    const userRoll = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    const systemRoll = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    
    const userTotal = userRoll[0] + userRoll[1];
    const systemTotal = systemRoll[0] + systemRoll[1];
    
    const won = userTotal > systemTotal;
    let payout = 0;

    if (won) {
      payout = bet * 2; // 2x multiplier
      await storage.updateUserBalance(user.id, payout);
      await storage.createTransaction(user.id, payout, "win", "Dice game win");
    }

    const updatedUser = await storage.getUser(user.id);

    res.json({
      won,
      roll: userRoll,
      systemRoll: systemRoll,
      userTotal,
      systemTotal,
      payout,
      newBalance: updatedUser?.balance || 0,
    });
  });

  // Mines — one-shot minefield game. The selected cell is represented by the
  // server-side outcome; the full grid is returned for the result animation.
  app.post(api.games.mines.path, gameLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    const bet = Number(req.body?.betAmount);
    const difficulty = req.body?.difficulty;
    const settings = {
      simple: { mineCount: 3, multiplier: 1.5 },
      extreme: { mineCount: 7, multiplier: 2.25 },
      impossible: { mineCount: 11, multiplier: 4 },
    } as const;

    if (!Number.isFinite(bet) || !Number.isInteger(bet) || bet < 1) {
      return res.status(400).json({ message: "Invalid bet amount." });
    }
    if (typeof difficulty !== "string" || !Object.hasOwn(settings, difficulty)) {
      return res.status(400).json({ message: "Invalid difficulty." });
    }
    if (bet > 100000) {
      return res.status(400).json({ message: "Bet amount exceeds maximum allowed." });
    }

    const userId = (req.user as any).id;
    const currentUser = await storage.getUser(userId);
    if (!currentUser || currentUser.balance < bet) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const { mineCount, multiplier } = settings[difficulty as keyof typeof settings];
    const minePositions = new Set<number>();
    while (minePositions.size < mineCount) {
      minePositions.add(Math.floor(Math.random() * 25));
    }
    const grid = Array.from({ length: 25 }, (_, index) => minePositions.has(index) ? 1 : 0);
    const selectedCell = Math.floor(Math.random() * 25);
    const won = grid[selectedCell] === 0;
    const payout = won ? Math.round(bet * multiplier) : 0;

    await storage.updateUserBalance(userId, -bet);
    await storage.createTransaction(userId, -bet, "loss", `Mines game bet (${difficulty})`);
    if (won) {
      await storage.updateUserBalance(userId, payout);
      await storage.createTransaction(userId, payout, "win", `Mines game win (${difficulty})`);
    }

    const updatedUser = await storage.getUser(userId);
    res.json({
      gameId: randomBytes(16).toString("hex"),
      won,
      payout,
      newBalance: updatedUser?.balance || 0,
      grid,
    });
  });

  app.post(api.games.spin.path, gameLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;

    if (user.lastDailySpin) {
      const last = new Date(user.lastDailySpin);
      const now = new Date();
      if (last.getDate() === now.getDate() && last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()) {
         return res.status(400).json({ message: "Already spun today" });
      }
    }

    // Rewards: $0.05, $0.10, $0.50, $1, $5, $10
    // Weighted probabilities (normalized to request)
    const rewards = [
      { amount: 5, weight: 80 },
      { amount: 10, weight: 60 },
      { amount: 50, weight: 50 },
      { amount: 100, weight: 30 },
      { amount: 500, weight: 20 },
      { amount: 1000, weight: 10 },
    ];

    const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    let reward = 0;

    for (const r of rewards) {
      if (random < r.weight) {
        reward = r.amount;
        break;
      }
      random -= r.weight;
    }

    await storage.updateUserBalance(user.id, reward);
    await storage.updateLastDailySpin(user.id);
    await storage.createTransaction(user.id, reward, "daily_spin", "Daily spin reward");

    const updatedUser = await storage.getUser(user.id);
    
    res.json({
      reward, // in cents
      newBalance: updatedUser?.balance || 0,
    });
  });

  // User - Update Email
  app.patch("/api/user/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) return res.status(400).json({ message: "Valid email required" });
      const user = await storage.updateUser((req.user as any).id, { email });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // User - Update Telegram username
  app.patch("/api/user/telegram", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const rawTelegramUsername = req.body?.telegramUsername;
      if (typeof rawTelegramUsername !== "string") {
        return res.status(400).json({ message: "Telegram username must be text" });
      }

      const telegramUsername = rawTelegramUsername.trim().replace(/^@+/, "");
      if (telegramUsername.length > 64 || !/^[a-zA-Z0-9_]*$/.test(telegramUsername)) {
        return res.status(400).json({ message: "Invalid Telegram username" });
      }

      const user = await storage.updateUser((req.user as any).id, { telegramUsername });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });


  // User Rank
  app.get("/api/user/rank", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const result = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), sql`amount > 0`, sql`type IN ('deposit', 'manual_deposit')`));
    const totalDeposited = Number(result[0]?.total ?? 0);
    const rank = totalDeposited >= 100000 ? "nyc" : totalDeposited >= 50000 ? "vip" : totalDeposited >= 10000 ? "regular" : "newbie";
    const discountPct = rank === "nyc" ? 10 : rank === "vip" ? 5 : rank === "regular" ? 2 : 0;
    const nextRankAt = rank === "newbie" ? 10000 : rank === "regular" ? 50000 : rank === "vip" ? 100000 : null;
    res.json({ rank, discountPct, totalDeposited, nextRankAt });
  });

  // User - Update Password
  app.patch("/api/user/password", passwordChangeLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both passwords required" });
      if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      const [currentUser] = await db.select().from(users).where(eq(users.id, (req.user as any).id));
      if (!currentUser) return res.status(404).json({ message: "User not found" });
      const isMatch = await comparePassword(currentPassword, currentUser.password);
      if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });
      const hashed = await hashPassword(newPassword);
      await storage.updateUser((req.user as any).id, { password: hashed });
      console.info(`[security] password changed for user ${(req.user as any).id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin - Deliver Order
  app.post(api.admin.deliverOrder.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const orderId = Number(req.params.id);
      // Accept either deliveryContents (per-product map) or legacy deliveryContent (string)
      let content: string;
      if (req.body.deliveryContents && typeof req.body.deliveryContents === "object") {
        content = JSON.stringify(req.body.deliveryContents);
      } else {
        content = req.body.deliveryContent || "";
      }
      const order = await storage.updateOrderDelivery(orderId, content);
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin - Ban User
  app.post(api.admin.banUser.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const user = await storage.banUser(Number(req.params.id));
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin - Unban User
  app.post(api.admin.unbanUser.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const user = await storage.unbanUser(Number(req.params.id));
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Verification - Submit
  app.post("/api/verification/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = (req.user as any).id;
      const { telegramUsername, channelLink, channelName, agreedToTerms } = req.body;
      if (!agreedToTerms) return res.status(400).json({ message: "Must agree to terms" });
      const existing = await db.select().from(verifications).where(eq(verifications.userId, userId));
      if (existing.length > 0) {
        const existingStatus = existing[0].status;
        if (existingStatus === "approved") {
          return res.status(400).json({ message: "Already verified" });
        }
        const [updated] = await db.update(verifications).set({ telegramUsername, channelLink, channelName, agreedToTerms, status: "pending" as any, adminNote: "", termMessage: "" }).where(eq(verifications.userId, userId)).returning();
        return res.json(updated);
      }
      const [verif] = await db.insert(verifications).values({ userId, telegramUsername, channelLink, channelName, agreedToTerms }).returning();
      res.status(201).json(verif);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Verification - Get Mine
  app.get("/api/verification/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const [verif] = await db.select().from(verifications).where(eq(verifications.userId, (req.user as any).id));
    res.json(verif || null);
  });

  // Admin - List Verifications
  app.get("/api/admin/verifications", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const all = await db.select().from(verifications).orderBy(verifications.createdAt);
    res.json(all);
  });

  // Admin - Approve Verification
  app.post("/api/admin/verifications/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const [verif] = await db.update(verifications).set({ status: "approved" as any, adminNote: req.body.note || "" }).where(eq(verifications.id, Number(req.params.id))).returning();
    res.json(verif);
  });

  // Admin - Deny Verification
  app.post("/api/admin/verifications/:id/deny", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const [verif] = await db.update(verifications).set({ status: "denied" as any, adminNote: req.body.note || "" }).where(eq(verifications.id, Number(req.params.id))).returning();
    res.json(verif);
  });

  // Admin - Term a seller (ban with message)
  app.post("/api/admin/verifications/:id/term", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const [verif] = await db.update(verifications).set({ status: "termed" as any, termMessage: req.body.message || "" }).where(eq(verifications.id, Number(req.params.id))).returning();
    res.json(verif);
  });

  // Admin - Unverify a seller (revoke, must reapply)
  app.post("/api/admin/verifications/:id/unverify", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const [verif] = await db.update(verifications).set({ status: "denied" as any, adminNote: "Verification revoked by admin" }).where(eq(verifications.id, Number(req.params.id))).returning();
    res.json(verif);
  });

  // Admin - Sellers list (all submitted verifications for management)
  app.get("/api/admin/sellers", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    try {
      const { rows } = await db.execute(sql`
        SELECT v.id, v.user_id, v.telegram_username, v.channel_link, v.channel_name,
               v.agreed_to_terms, v.status, v.admin_note, v.term_message, v.created_at,
               u.id as u_id, u.username as u_username, u.email as u_email
        FROM verifications v
        LEFT JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC
      `) as any;
      const result = [];
      for (const row of rows) {
        if (!row.u_id) continue;
        const { rows: ipRows } = await db.execute(sql`SELECT ip FROM user_ips WHERE user_id = ${row.user_id} ORDER BY logged_at DESC`) as any;
        const uniqueIps = Array.from(new Set(ipRows.map((i: any) => i.ip)));
        result.push({
          id: row.id, userId: row.user_id, telegramUsername: row.telegram_username,
          channelLink: row.channel_link, channelName: row.channel_name,
          agreedToTerms: row.agreed_to_terms, status: row.status,
          adminNote: row.admin_note, termMessage: row.term_message, createdAt: row.created_at,
          user: { id: row.u_id, username: row.u_username, email: row.u_email },
          ips: uniqueIps, totalLogins: ipRows.length,
        });
      }
      res.json(result);
    } catch (e: any) {
      console.error("sellers route error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // Admin - Approved sellers only (for mail recipient dropdown)
  app.get("/api/admin/sellers/approved", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    try {
      const { rows } = await db.execute(sql`
        SELECT v.id, v.user_id, v.telegram_username, v.channel_link, v.channel_name,
               v.agreed_to_terms, v.status, v.admin_note, v.term_message, v.created_at,
               u.id as u_id, u.username as u_username, u.email as u_email
        FROM verifications v
        LEFT JOIN users u ON u.id = v.user_id
        WHERE v.status = 'approved'
        ORDER BY v.created_at DESC
      `) as any;
      const result = rows.filter((r: any) => r.u_id).map((row: any) => ({
        id: row.id, userId: row.user_id, telegramUsername: row.telegram_username,
        channelLink: row.channel_link, channelName: row.channel_name,
        agreedToTerms: row.agreed_to_terms, status: row.status,
        adminNote: row.admin_note, termMessage: row.term_message, createdAt: row.created_at,
        user: { id: row.u_id, username: row.u_username, email: row.u_email },
      }));
      res.json(result);
    } catch (e: any) {
      console.error("sellers/approved route error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // === MAIL ROUTES ===

  // Admin: send mail to one seller or all sellers
  app.post("/api/admin/mails/send", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const { title, body, recipientId } = req.body;
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: "Title and body required" });
    const [mail] = await db.insert(mails).values({
      title: title.trim(),
      body: body.trim(),
      senderId: (req.user as any).id,
      recipientId: recipientId ? Number(recipientId) : null,
    }).returning();
    res.json(mail);
  });

  // User: get own mails (all-sellers broadcasts + personal)
  app.get("/api/mails", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const allMails = await db.select().from(mails).orderBy(desc(mails.createdAt));
    const myMails = allMails.filter(m => m.recipientId === null || m.recipientId === userId);
    const reads = await db.select().from(mailReads).where(eq(mailReads.userId, userId));
    const readIds = new Set(reads.map(r => r.mailId));
    res.json(myMails.map(m => ({ ...m, isRead: readIds.has(m.id) })));
  });

  // User: mark mail as read
  app.post("/api/mails/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const mailId = Number(req.params.id);
    const existing = await db.select().from(mailReads).where(and(eq(mailReads.mailId, mailId), eq(mailReads.userId, userId)));
    if (existing.length === 0) {
      await db.insert(mailReads).values({ mailId, userId });
    }
    res.json({ ok: true });
  });

  // Admin - Update Order Status
  app.patch("/api/admin/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { status } = req.body;
      const [order] = await db.update(orders).set({ status } as any).where(eq(orders.id, Number(req.params.id))).returning();
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin - Test Order (No Payment)
  app.post("/api/admin/test-order", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { productId, variantId, quantity } = req.body;
      const [variant] = await db.select().from(variants).where(eq(variants.id, variantId));
      if (!variant) throw new Error("Variant not found");
      
      const total = variant.price * quantity;
      const orderId = `TEST-${Date.now()}`;
      
      const [order] = await db.insert(orders).values({
        orderId,
        userId: (req.user as any).id,
        status: "delivering" as any,
        total
      }).returning();

      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: variant.id,
        stockItemId: null,
        cardId: null,
        itemType: "product",
        price: variant.price,
        quantity,
      });
      
      res.status(201).json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin
  app.get(api.admin.dashboard.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.post(api.admin.generateCodes.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const amount = Number(req.body?.amount);
    const count = Number(req.body?.count);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
      return res.status(400).json({ message: "Amount must be a whole number of cents between 1 and 100,000,000." });
    }
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      return res.status(400).json({ message: "Count must be a whole number between 1 and 100." });
    }

    try {
      const codes: string[] = [];
      let attempts = 0;
      while (codes.length < count && attempts < 3) {
        attempts++;
        const batch = Array.from({ length: count - codes.length }, () => ({
          code: `VOUCH-${randomBytes(8).toString("hex").toUpperCase()}`,
          amount,
        }));
        const inserted = await storage.createRedeemCodes(batch);
        codes.push(...inserted.map((code) => code.code));
      }

      if (codes.length !== count) {
        throw new Error("Unable to generate a unique set of redeem codes");
      }
      res.json({ codes });
    } catch (error) {
      console.error("[admin] redeem code generation failed:", error);
      res.status(500).json({ message: "Unable to generate redeem codes right now." });
    }
  });

  // Admin Products (all products including hidden)
  app.get("/api/admin/products", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const products = await storage.getAllProducts();
    res.json(products);
  });

  app.patch("/api/admin/products/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const product = await storage.updateProduct(Number(req.params.id), req.body);
    res.json(product);
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteProduct(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/clear-all-data", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      await db.delete(orderItems);
      await db.delete(cryptoPayments);
      await db.delete(stockItems);
      await db.delete(orders);
      await db.delete(variants);
      await db.delete(products);
      await db.delete(cards);
      await db.delete(transactions);
      await db.update(users).set({ balance: 0, protectedBalance: 0 });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/variants/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const variant = await storage.updateVariant(Number(req.params.id), req.body);
    res.json(variant);
  });

  app.delete("/api/admin/variants/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteVariant(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/stock", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const item = await storage.addSingleStockItem(req.body.variantId, req.body.content);
    res.status(201).json(item);
  });

  app.post("/api/admin/stock/bulk", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const sellerId = req.body.sellerId ? Number(req.body.sellerId) : undefined;
    const result = await storage.addStockItems(req.body.variantId, req.body.rawContent, sellerId);
    res.json({ addedCount: result.added, skippedCount: result.skipped });
  });

  app.post(
    "/api/admin/stock/license-file",
    express.text({
      type: ["text/plain", "text/csv", "application/octet-stream"],
      limit: `${MAX_LICENSE_FILE_BYTES}b`,
    }),
    async (req, res) => {
      if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
      try {
        const variantId = Number(req.query.variantId);
        if (!Number.isInteger(variantId) || variantId <= 0) {
          return res.status(400).json({ message: "A valid variantId is required" });
        }
        const keys = parseLicenseKeyFile(req.body);
        const result = await storage.addStockItems(variantId, keys.join("\n\n"));
        res.json({
          addedCount: result.added,
          skippedCount: result.skipped,
          keyCount: keys.length,
        });
      } catch (error: any) {
        res.status(400).json({ message: error?.message ?? "Invalid license-key file" });
      }
    },
  );

  app.get("/api/admin/stock/:variantId", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const items = await storage.getStockItems(Number(req.params.variantId));
    res.json(items);
  });

  app.delete("/api/admin/stock/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteStockItem(Number(req.params.id));
    res.json({ success: true });
  });

  // Admin/Worker - Get all orders
  app.get("/api/admin/orders", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const allOrders = await storage.getAllOrders();
    res.json(allOrders);
  });

  // Worker order feed. Keep this separate from the admin route so the worker
  // dashboard does not depend on an admin-only URL or admin action handlers.
  app.get("/api/worker/orders", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      res.json(await storage.getAllOrders());
    } catch (error) {
      console.error("[worker orders] failed to load:", error);
      res.status(500).json({ message: "Unable to load orders right now." });
    }
  });

  // Admin/Worker - Get all users
  app.get("/api/admin/users", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  });

  // Old Admin Orders (keeping for backward compat)
  app.get("/api/admin/orders-old", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const orders = await storage.getAllOrders();
    res.json(orders);
  });

  app.post("/api/admin/orders/:id/refund", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const order = await storage.refundOrder(Number(req.params.id));
    res.json(order);
  });

  app.post("/api/admin/orders/:id/replace", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const order = await storage.replaceOrder(Number(req.params.id));
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const targetId = Number(req.params.id);
    const target = await storage.getUser(targetId);
    if (target && target.id === (req.user as any).id) return res.status(403).json({ message: "Cannot modify your own account" });
    const { isBanned, role, email } = req.body;
    const user = await storage.updateUser(targetId, { isBanned, role, email });
    res.json(user);
  });

  app.post("/api/admin/users/:id/balance", async (req, res) => {
    if (!req.isAuthenticated() || ((req.user as any).role !== 'admin' && !(req.user as any).isWorker)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.updateUserBalance(Number(req.params.id), req.body.amount);
    if (req.body.amount > 0) {
      await storage.updateProtectedBalance(Number(req.params.id), req.body.amount);
    }
    await storage.createTransaction(Number(req.params.id), req.body.amount, "admin_adjustment", "Admin balance adjustment");
    res.json(user);
  });

  // Set user balance to an absolute value
  app.post("/api/admin/users/:id/set-balance", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = Number(req.params.id);
    const newBalance = Math.round(Number(req.body.balance) * 100); // dollars → cents
    const existing = await storage.getUser(userId);
    if (!existing) return res.status(404).json({ message: "User not found" });
    const delta = newBalance - existing.balance;
    await db.update(users).set({ balance: newBalance } as any).where(eq(users.id, userId));
    await storage.createTransaction(userId, delta, "admin_adjustment", `Admin set balance to $${(newBalance / 100).toFixed(2)}`);
    const updated = await storage.getUser(userId);
    res.json(updated);
  });

  // Set user role (promote/demote admin)
  app.post("/api/admin/users/:id/set-role", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = Number(req.params.id);
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    await db.update(users).set({ role } as any).where(eq(users.id, userId));
    const updated = await storage.getUser(userId);
    res.json(updated);
  });

  // Toggle worker status
  app.post("/api/admin/users/:id/set-worker", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = Number(req.params.id);
    const { isWorker } = req.body;
    await db.update(users).set({ isWorker: Boolean(isWorker) } as any).where(eq(users.id, userId));
    const updated = await storage.getUser(userId);
    res.json(updated);
  });

  // Admin - Set a user's password
  app.patch("/api/admin/users/:id/password", passwordChangeLimiter, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = Number(req.params.id);
    const { newPassword } = req.body ?? {};
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user" });
    }
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const target = await storage.getUser(userId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const hashed = await hashPassword(newPassword);
    await storage.updateUser(userId, { password: hashed });
    console.info(`[security] admin ${(req.user as any).id} changed password for user ${userId}`);
    res.json({ success: true });
  });

  // Admin: get crypto addresses for a user
  app.get("/api/admin/users/:id/crypto-addresses", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const addresses = await storage.getCryptoAddresses(Number(req.params.id));
    res.json(addresses);
  });

  // Admin: set crypto address for a user
  app.post("/api/admin/users/:id/crypto-addresses", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { currency, address } = req.body;
    if (!currency || !address) return res.status(400).json({ message: "currency and address required" });
    const result = await storage.setCryptoAddress(Number(req.params.id), currency, address);
    res.json(result);
  });

  // User: get own crypto addresses
  app.get("/api/user/crypto-addresses", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const addresses = await storage.getCryptoAddresses(userId);
    res.json(addresses);
  });

  // Admin Balance Codes (list)
  app.get("/api/admin/codes", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const codes = await storage.getAllRedeemCodes();
    res.json(codes);
  });

  // === DISCOUNT CODES ===

  // Validate a discount code (authenticated users)
  app.post("/api/discount/validate", walletLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { code, cartTotal } = req.body;
      if (!code || typeof code !== "string") return res.status(400).json({ message: "Code required" });

      const [dc] = await db.select().from(discountCodes)
        .where(eq(discountCodes.code, code.toUpperCase().trim()));

      if (!dc || !dc.isActive) return res.status(404).json({ message: "Invalid or inactive code" });
      if (dc.expiresAt && new Date(dc.expiresAt) < new Date()) return res.status(400).json({ message: "This code has expired" });
      if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) return res.status(400).json({ message: "This code has reached its usage limit" });
      if (dc.minOrder && cartTotal < dc.minOrder) {
        return res.status(400).json({ message: `Minimum order of $${(dc.minOrder / 100).toFixed(2)} required` });
      }

      const discountAmount = dc.type === "percent"
        ? Math.round(cartTotal * dc.value / 100)
        : Math.min(dc.value, cartTotal);

      res.json({ id: dc.id, code: dc.code, type: dc.type, value: dc.value, discountAmount });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: list discount codes
  app.get("/api/admin/discount-codes", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const all = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
    res.json(all);
  });

  // Admin: create discount code
  app.post("/api/admin/discount-codes", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    try {
      const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
      if (!code || !type || !value) return res.status(400).json({ message: "Code, type, and value required" });
      if (!["percent", "fixed"].includes(type)) return res.status(400).json({ message: "Type must be percent or fixed" });
      if (type === "percent" && (value < 1 || value > 100)) return res.status(400).json({ message: "Percent must be 1–100" });

      const [dc] = await db.insert(discountCodes).values({
        code: code.toUpperCase().trim(),
        type,
        value: type === "fixed" ? Math.round(parseFloat(value) * 100) : parseInt(value),
        minOrder: minOrder ? Math.round(parseFloat(minOrder) * 100) : 0,
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();
      res.status(201).json(dc);
    } catch (e: any) {
      if (e.code === "23505") return res.status(400).json({ message: "A code with that name already exists" });
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: toggle active / delete discount code
  app.patch("/api/admin/discount-codes/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    const [dc] = await db.update(discountCodes).set({ isActive: req.body.isActive }).where(eq(discountCodes.id, Number(req.params.id))).returning();
    res.json(dc);
  });

  app.delete("/api/admin/discount-codes/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.status(401).json({ message: "Unauthorized" });
    await db.delete(discountCodes).where(eq(discountCodes.id, Number(req.params.id)));
    res.json({ success: true });
  });

  // Admin Announcements
  app.get("/api/admin/announcements", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const announcements = await storage.getAllAnnouncements();
    res.json(announcements);
  });

  app.get("/api/admin/announcements/config", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const bannerColor = await storage.getSetting("announcement_banner_color", "#5a0000");
    res.json({ bannerColor });
  });

  app.patch("/api/admin/announcements/config", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const bannerColor = typeof req.body.bannerColor === "string"
      ? req.body.bannerColor.trim().toLowerCase()
      : "";
    if (!/^#[0-9a-f]{6}$/.test(bannerColor)) {
      return res.status(400).json({ message: "Banner color must be a 6-digit hex color." });
    }
    await storage.setSetting("announcement_banner_color", bannerColor);
    res.json({ bannerColor });
  });

  app.post("/api/admin/announcements", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content) return res.status(400).json({ message: "Announcement message is required" });
    if (content.length > 300) return res.status(400).json({ message: "Announcement message must be 300 characters or fewer" });

    const link = typeof req.body.link === "string" ? req.body.link.trim() : "";
    if (link) {
      try {
        const parsedLink = new URL(link);
        if (!["http:", "https:"].includes(parsedLink.protocol)) {
          return res.status(400).json({ message: "Announcement links must use http or https" });
        }
      } catch {
        return res.status(400).json({ message: "Announcement link must be a valid URL" });
      }
    }

    const payload = {
      content,
      ...(link ? { link } : {}),
      ...(typeof req.body.active === "boolean" ? { active: req.body.active } : {}),
    };
    const parsed = insertAnnouncementSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid announcement" });
    }
    const announcement = await storage.createAnnouncement(parsed.data);
    res.status(201).json(announcement);
  });

  app.patch("/api/admin/announcements/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (typeof req.body.active !== "boolean") {
      return res.status(400).json({ message: "Active status must be a boolean" });
    }
    const announcement = await storage.updateAnnouncement(Number(req.params.id), { active: req.body.active });
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    res.json(announcement);
  });

  app.delete("/api/admin/announcements/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await storage.deleteAnnouncement(Number(req.params.id));
    res.json({ success: true });
  });

  // Admin Logs
  app.get("/api/admin/logs", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const logs = await storage.getAdminLogs();
    res.json(logs);
  });

  // Image Upload (Admin only)
  app.post("/api/upload", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const validated = validateImageUpload(req.body?.data);
    if (!validated) {
      return res.status(400).json({ message: "Upload a PNG, JPEG, or WebP image smaller than 4 MB" });
    }
    const filename = `image-${randomBytes(12).toString("hex")}.${validated.extension}`;
    const image = await storage.uploadImage(filename, validated.mimeType, validated.data);
    res.status(201).json({ id: image.id, url: `/api/images/${image.id}` });
  });

  // Serve uploaded images
  app.get("/api/images/:id", async (req, res) => {
    const image = await storage.getImage(Number(req.params.id));
    if (!image) return res.status(404).json({ message: "Image not found" });
    
    const buffer = Buffer.from(image.data, "base64");
    const safeImage = imageSignatures.find((candidate) => candidate.mimeType === image.mimeType && candidate.matches(buffer));
    if (!safeImage) return res.status(404).json({ message: "Image not found" });
    res.setHeader("Content-Type", safeImage.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(buffer);
  });

  // Cards
  // === CARD BASES ===
  app.get("/api/card-bases", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const bases = user?.role === "admin"
      ? await storage.getCardBasesWithCount()
      : user?.isWorker
        ? await storage.getCardBasesWithCount(Number(user.id))
        : [];
    res.json(bases);
  });

  app.post("/api/admin/card-bases", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const { name, refundable } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });
    try {
      const user = req.user as any;
      const ownerId = user.role === "admin" ? undefined : Number(user.id);
      if (ownerId !== undefined) {
        const ownedBases = await storage.getCardBasesWithCount(ownerId);
        if (ownedBases.length >= 1) {
          return res.status(409).json({ message: "Workers can only create one card base" });
        }
      }
      const base = await storage.createCardBase(name.trim(), Boolean(refundable), ownerId);
      res.status(201).json(base);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/worker/card-bases", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.isWorker !== true) {
      return res.status(403).json({ message: "Worker access required" });
    }
    const { name, refundable } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });
    try {
      const ownerId = Number((req.user as any).id);
      const ownedBases = await storage.getCardBasesWithCount(ownerId);
      if (ownedBases.length >= 1) {
        return res.status(409).json({ message: "Workers can only create one card base" });
      }
      const base = await storage.createCardBase(name.trim(), Boolean(refundable), ownerId);
      res.status(201).json(base);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/worker/card-bases", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.isWorker !== true) {
      return res.status(403).json({ message: "Worker access required" });
    }
    const bases = await storage.getCardBasesWithCount(Number((req.user as any).id));
    res.json(bases.map((base: any) => ({ ...base, revenue: base.profit })));
  });

  app.patch("/api/admin/card-bases/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { name, refundable } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });
    const hasHrPercent = req.body.hrPercent !== undefined;
    const hrPercent = Number(req.body.hrPercent);
    if (hasHrPercent && (!Number.isFinite(hrPercent) || !Number.isInteger(hrPercent) || hrPercent < 0 || hrPercent > 100)) {
      return res.status(400).json({ message: "Valid rate must be a whole number from 0 to 100" });
    }
    try {
      const base = await storage.updateCardBase(
        Number(req.params.id),
        name.trim(),
        typeof refundable === "boolean" ? refundable : undefined,
        hasHrPercent ? hrPercent : undefined,
      );
      res.json(base);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/card-bases/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteCardBase(Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/card-bases/:id/cards", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const requestedBaseId = Number(req.params.id);
    const user = req.user as any;
    if (user.role !== "admin") {
      const [ownedBase] = await db.select({ id: cardBases.id })
        .from(cardBases)
        .where(and(eq(cardBases.id, requestedBaseId), eq(cardBases.ownerId, Number(user.id))));
      if (!ownedBase) return res.status(403).json({ message: "You do not own this base" });
    }
    const cards = await storage.getCardsByBase(requestedBaseId);
    res.json(cards);
  });

  app.get("/api/cards", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const baseId = req.query.baseId ? Number(req.query.baseId) : null;
    const user = req.user as any;
    let baseFilter = baseId ? sql`AND c.base_id = ${baseId}` : sql``;
    if (user?.role !== "admin" && user?.isWorker) {
      const [ownedBase] = await db.select({ id: cardBases.id })
        .from(cardBases)
        .where(eq(cardBases.ownerId, Number(user.id)));
      if (!ownedBase) return res.json([]);
      if (baseId && baseId !== ownedBase.id) return res.status(403).json({ message: "You do not own this base" });
      baseFilter = sql`AND c.base_id = ${ownedBase.id}`;
    }
    const { rows } = await db.execute(sql`
      SELECT c.id, c.card_number, c.masked_card, c.expiry, c.cvv, c.country, c.extras,
             c.price, c.hr_percent, c.is_sold, c.is_first_hand, c.user_id, c.created_at, c.bin_data,
             c.base_id, cb.name as base_name, cb.refundable as base_refundable,
             cb.hr_percent as base_hr_percent
      FROM cards c
      LEFT JOIN card_bases cb ON cb.id = c.base_id
      WHERE c.is_sold = false ${baseFilter}
      ORDER BY c.created_at DESC
    `) as any;

    // For cards missing bin_data in DB, kick off background lookups + save results
    const needsLookup = rows.filter((r: any) => !r.bin_data && (r.card_number ?? "").replace(/\D/g, "").length >= 6);
    const seenBins = new Set<string>();
    needsLookup.forEach((r: any) => {
      const bin = (r.card_number ?? "").replace(/\D/g, "").substring(0, 6);
      if (bin.length === 6 && !seenBins.has(bin)) {
        seenBins.add(bin);
        lookupBin(bin).then(async (data) => {
          if (data?.bank || data?.scheme || data?.type) {
            await db.execute(sql`
              UPDATE cards
              SET bin_data = ${JSON.stringify(data)}::jsonb,
                  country = COALESCE(NULLIF(${data.country ?? ""}, ''), country)
              WHERE card_number LIKE ${bin + '%'} AND bin_data IS NULL
            `);
          }
        }).catch(() => {});
      }
    });

    res.json(rows.map((r: any) => ({
      id: r.id, cardNumber: r.card_number, maskedCard: r.masked_card,
       expiry: r.expiry, cvv: r.cvv, country: r.bin_data?.country ?? r.country, extras: r.extras,
      price: r.price, hrPercent: r.base_hr_percent ?? 80, isSold: r.is_sold, isFirstHand: r.is_first_hand,
      userId: r.user_id, createdAt: r.created_at,
      binData: r.bin_data ?? null,
       baseId: r.base_id ?? null, baseName: r.base_name ?? null,
       baseRefundable: Boolean(r.base_refundable),
    })));
  });

  app.post("/api/cards", async (req, res) => {
    if (!req.isAuthenticated() || ((req.user as any).role !== 'admin' && !(req.user as any).isWorker)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const rawInput: string = req.body.extras || "";

    // Robust card number extractor — works with any delimiter or spacing
    function findCardNumber(line: string): string {
      if (!line) return "";
      const tokens = line.split(/[|\t:;,\s]+/).map((t: string) => t.trim()).filter(Boolean);
      // First pass: token whose digits are 13-19 long and starts with 3/4/5/6
      for (const token of tokens) {
        const digits = token.replace(/\D/g, "");
        if (digits.length >= 13 && digits.length <= 19 && /^[3456]/.test(digits)) return digits;
      }
      // Second pass: scan concatenated string for a 13-19 digit run starting with 3/4/5/6
      const noGaps = line.replace(/[\s\-]/g, "");
      const m = noGaps.match(/[3456]\d{12,18}/);
      if (m) return m[0];
      // Fallback: first numeric token >= 6 digits
      for (const token of tokens) {
        const digits = token.replace(/\D/g, "");
        if (digits.length >= 6) return digits;
      }
      return "";
    }

    // Multiple cards can be pasted one per line; blank lines are ignored.
    const entries = rawInput.split(/\r?\n/).map((e: string) => e.trim()).filter(Boolean);
    if (entries.length === 0) {
      return res.status(400).json({ message: "Full item is required" });
    }

    const baseId = req.body.baseId ? Number(req.body.baseId) : 0;
    const priceCents = Math.round(parseFloat(req.body.price || "0") * 100);
    const user = req.user as any;

    if (!Number.isInteger(baseId) || baseId <= 0) {
      return res.status(400).json({ message: "A valid base is required" });
    }
    const [selectedBase] = await db.select({ id: cardBases.id, ownerId: cardBases.ownerId })
      .from(cardBases)
      .where(eq(cardBases.id, baseId));
    if (!selectedBase) return res.status(404).json({ message: "Base not found" });
    if (user.role !== "admin" && selectedBase.ownerId !== Number(user.id)) {
      return res.status(403).json({ message: "Workers can only add cards to their own base" });
    }

    const createdCards: any[] = [];

    for (const fullItem of entries) {
      const cardNumber = findCardNumber(fullItem) || req.body.cardNumber || "";
      const masked = cardNumber.length >= 4
        ? cardNumber.substring(0, 6) + "*".repeat(Math.max(0, cardNumber.length - 10)) + cardNumber.slice(-4)
        : cardNumber;
      let country = "Unknown";
      let storedBinData: any = null;

      if (cardNumber.length >= 6) {
        const bin = cardNumber.substring(0, 6);
        try {
          const binResult = await lookupBin(bin);
          if (binResult) {
            storedBinData = binResult;
            country = binResult.country || "Unknown";
          }
        } catch {}
      }

      const card = await storage.createCard({
        cardNumber,
        maskedCard: masked,
        expiry: "",
        cvv: "",
        country,
        extras: fullItem,
        price: priceCents,
        isFirstHand: false,
        hrPercent: 80,
         baseId,
      } as any);

      // Save binData to DB immediately so it's always available
      if (storedBinData) {
        await db.execute(sql`UPDATE cards SET bin_data = ${JSON.stringify(storedBinData)}::jsonb WHERE id = ${card.id}`);
      }

      createdCards.push({ ...card, binData: storedBinData });
    }

    if (createdCards.length === 1) {
      res.status(201).json(createdCards[0]);
    } else {
      res.status(201).json({ cards: createdCards, count: createdCards.length });
    }
  });

  app.post("/api/cards/:id/purchase", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const cardId = Number(req.params.id);
      const userId = (req.user as any).id;
      const card = await storage.getCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });

      // Apply rank discount
      const rankResult = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), sql`amount > 0`, sql`type IN ('deposit', 'manual_deposit')`));
      const totalDeposited = Number(rankResult[0]?.total ?? 0);
      const rankPct = totalDeposited >= 100000 ? 10 : totalDeposited >= 50000 ? 5 : totalDeposited >= 10000 ? 2 : 0;
      const finalPrice = rankPct > 0 ? Math.max(0, Math.round(card.price * (1 - rankPct / 100))) : card.price;

      const user = await storage.getUser(userId);
      if (!user || user.balance < finalPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await storage.updateUserBalance(userId, -finalPrice);
      await storage.createTransaction(userId, -finalPrice, "purchase", `Purchased card ${card.maskedCard}`);

      const updatedCard = await storage.purchaseCard(cardId, userId, finalPrice);
      res.json(updatedCard);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/user/cards", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const cards = await storage.getUserCards((req.user as any).id);
    res.json(cards);
  });

  app.delete("/api/admin/cards/:id", async (req, res) => {
    if (!isAdminOrWorker(req)) return res.status(401).json({ message: "Unauthorized" });
    const card = await storage.getCard(Number(req.params.id));
    const user = req.user as any;
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (user.role !== "admin") {
      const [ownedBase] = card.baseId
        ? await db.select({ id: cardBases.id }).from(cardBases)
            .where(and(eq(cardBases.id, card.baseId), eq(cardBases.ownerId, Number(user.id))))
        : [];
      if (!ownedBase) return res.status(403).json({ message: "You do not own this card" });
    }
    await storage.deleteCard(card.id);
    res.json({ success: true });
  });

  // Support
  app.post("/api/support", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const ticket = await storage.createSupportTicket({ ...req.body, userId: (req.user as any).id });
    res.status(201).json(ticket);
  });

  app.get("/api/support", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const tickets = await storage.getSupportTickets((req.user as any).id);
    res.json(tickets);
  });

  app.get("/api/admin/support", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const tickets = await storage.getSupportTickets();
    res.json(tickets);
  });

  app.patch("/api/admin/support/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { action, message } = req.body;
    const ticket = await storage.getSupportTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    try {
      if (action === "refund") {
        const order = await db.select().from(orders).where(eq(orders.orderId, ticket.orderId)).limit(1);
        if (order.length > 0) {
          await storage.refundOrder(order[0].id);
        }
      } else if (action === "replace") {
        const order = await db.select().from(orders).where(eq(orders.orderId, ticket.orderId)).limit(1);
        if (order.length > 0) {
          await storage.replaceOrder(order[0].id);
        }
      }
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }

    const newStatus = action === "refund" ? "refunded" : action === "replace" ? "replaced" : "resolved";
    const updated = await storage.updateSupportTicket(Number(req.params.id), { 
      status: newStatus,
      adminMessage: message || ticket.adminMessage
    });
    res.json(updated);
  });

  app.post("/api/orders/crypto", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    let pendingOrderId: number | null = null;
    try {
      const userId = (req.user as any).id;
      const { items, cardIds, discountCodeId } = req.body;
      const productItems = (items || []).filter((i: any) => !i.cardId && i.variantId > 0);
      const cardIdList: number[] = cardIds || [];

      const order = await storage.createPendingOrder(userId, productItems, cardIdList, discountCodeId ?? null);
      pendingOrderId = order.id;

      const totalWithFee = order.total;
      const amountUsd = totalWithFee / 100;

      const origin = (req.headers.origin as string) || `https://${req.headers.host}`;
      const invoice = await createNowPaymentsInvoice({
        amount: amountUsd,
        orderId: `order-${order.id}`,
        successUrl: `${origin}/profile?tab=orders`,
        cancelUrl: `${origin}/profile?tab=orders`,
        ipnCallbackUrl: `${origin}/api/webhooks/nowpayments`,
      });

      if (!invoice.id || !invoice.url) {
        await storage.cancelPendingOrder(order.id);
        pendingOrderId = null;
        return res.status(502).json({ message: "Payment provider error. Please try again." });
      }

      await db.insert(cryptoPayments).values({
        userId,
        forebitPaymentId: invoice.id,
        amount: totalWithFee,
        currency: "USD",
        status: "pending",
        purpose: "order",
        orderId: order.id,
        checkoutUrl: invoice.url,
        metadata: null,
      });

      pendingOrderId = null;
      res.status(201).json({
        order,
        paymentId: invoice.id,
        checkoutUrl: invoice.url,
      });
    } catch (e: any) {
      console.error("Crypto order creation failed:", e);
      if (pendingOrderId != null) {
        try { await storage.cancelPendingOrder(pendingOrderId as number); } catch {}
      }
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/payments/crypto/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { amount, purpose, orderId } = req.body;
      // amount arrives in cents from the frontend (e.g. 500 = $5.00)
      const amountUsd = parseFloat(amount) / 100;

      if (!amountUsd || amountUsd < 1) {
        return res.status(400).json({ message: "Minimum deposit is $1" });
      }
      if (amountUsd > 1000000000) {
        return res.status(400).json({ message: "Maximum deposit is $1,000,000,000" });
      }

      const userId = (req.user as any).id;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = purpose === "order" ? `${baseUrl}/orders` : `${baseUrl}/deposit`;

      const invoice = await createNowPaymentsInvoice({
        amount: amountUsd,
        orderId: orderId ? `order-${orderId}` : `deposit-${userId}-${Date.now()}`,
        successUrl,
        cancelUrl: successUrl,
        ipnCallbackUrl: `${baseUrl}/api/webhooks/nowpayments`,
      });

      if (!invoice.id || !invoice.url) {
        return res.status(502).json({ message: "Payment provider returned an invalid response. Please try again." });
      }

      await db.insert(cryptoPayments).values({
        userId,
        forebitPaymentId: invoice.id,
        amount: Math.round(amountUsd * 100),
        currency: "USD",
        status: "pending",
        purpose: purpose || "deposit",
        orderId: orderId ? Number(orderId) : null,
        checkoutUrl: invoice.url,
        metadata: JSON.stringify({ nowpaymentsResponse: invoice }),
      });

      res.json({ paymentId: invoice.id, checkoutUrl: invoice.url });
    } catch (error: any) {
      console.error("NOWPayments invoice creation failed:", error);
      res.status(500).json({ message: "Failed to create payment. Please try again later." });
    }
  });

  // Keep legacy alias so any in-flight links still resolve
  app.post("/api/payments/forebit/create", (req, res) => res.redirect(307, "/api/payments/crypto/create"));

  app.get("/api/payments/crypto/:paymentId/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { paymentId } = req.params;
      const userId = (req.user as any).id;

      const [localPayment] = await db
        .select()
        .from(cryptoPayments)
        .where(eq(cryptoPayments.forebitPaymentId, paymentId))
        .limit(1);

      if (!localPayment || localPayment.userId !== userId) {
        return res.status(404).json({ message: "Payment not found" });
      }

       if (localPayment.status === "completed" && localPayment.settledAt) {
        return res.json({ status: "completed", amount: localPayment.amount, purpose: localPayment.purpose, orderId: localPayment.orderId });
      }

      try {
        const invoice = await getNowPaymentsInvoice(paymentId);
        const newStatus = mapNowPaymentsStatus(invoice.payment_status || invoice.status || "");

        if (newStatus !== localPayment.status) {
          const [updated] = await db
            .update(cryptoPayments)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(and(eq(cryptoPayments.id, localPayment.id), ne(cryptoPayments.status, "completed")))
            .returning();

           if (newStatus === "completed" && updated) {
             await settleCryptoPayment(localPayment.id);
          }
          if ((newStatus === "failed" || newStatus === "expired") && updated && localPayment.purpose === "order" && localPayment.orderId) {
            await storage.cancelPendingOrder(localPayment.orderId);
          }
        }

         const status = localPayment.status === "completed" ? "completed" : newStatus;
         if (status === "completed") {
           await settleCryptoPayment(localPayment.id);
         }
         res.json({ status, amount: localPayment.amount, purpose: localPayment.purpose, orderId: localPayment.orderId });
      } catch {
        res.json({ status: localPayment.status, amount: localPayment.amount });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Legacy alias
  app.get("/api/payments/forebit/:paymentId/status", (req, res) =>
    res.redirect(307, `/api/payments/crypto/${req.params.paymentId}/status`));

  app.post("/api/webhooks/nowpayments", async (req, res) => {
    try {
      console.log("NOWPayments IPN received:", JSON.stringify(req.body, null, 2));
      const body = req.body || {};
      const sig = req.headers["x-nowpayments-sig"] as string || "";
      const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

      if (!ipnSecret) {
        console.error("NOWPayments IPN: NOWPAYMENTS_IPN_SECRET is not configured");
        return res.status(503).json({ received: false });
      }

      if (!sig || !verifyNowPaymentsWebhook(body, sig)) {
        console.warn("NOWPayments IPN: missing or invalid signature");
        return res.status(200).json({ received: true });
      }

      // IPN body contains invoice_id and payment_status
      const invoiceId = String(body.invoice_id || body.id || "");
      const status = body.payment_status || body.status || "";

      if (!invoiceId) {
        console.warn("NOWPayments IPN: no invoice_id in body:", JSON.stringify(body));
        return res.status(200).json({ received: true });
      }

      const [payment] = await db
        .select()
        .from(cryptoPayments)
        .where(eq(cryptoPayments.forebitPaymentId, invoiceId))
        .limit(1);

      if (!payment) {
        console.warn("NOWPayments IPN: payment not found for invoice:", invoiceId);
        return res.status(200).json({ received: true });
      }

      if (payment.status === "completed" && payment.settledAt) {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }

      const newStatus = mapNowPaymentsStatus(status);
      const [updated] = await db
        .update(cryptoPayments)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(cryptoPayments.id, payment.id), ne(cryptoPayments.status, "completed")))
        .returning();

      if (newStatus === "completed" && updated) {
        await settleCryptoPayment(payment.id);
      } else if (payment.status === "completed") {
        await settleCryptoPayment(payment.id);
      }
      if ((newStatus === "failed" || newStatus === "expired") && updated && payment.purpose === "order" && payment.orderId) {
        await storage.cancelPendingOrder(payment.orderId);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("NOWPayments IPN error:", error);
      res.status(200).json({ received: true });
    }
  });

  // ── Payment method config (public) ───────────────────────────────────────
  app.get("/api/payment-methods", async (_req, res) => {
    const config = await storage.getPaymentMethodsConfig();
    res.json(config);
  });

  // ── Payment method admin toggle ───────────────────────────────────────────
  app.get("/api/admin/payment-methods", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(await storage.getPaymentMethodsConfig());
  });

  app.patch("/api/admin/payment-methods/:method", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { method } = req.params;
    const { enabled } = req.body;
    if (!["crypto", "stars", "cashapp", "wallet", "chime", "zelle", "venmo"].includes(method) || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "Invalid request" });
    }
    await storage.setSetting(`payment_method_${method}`, String(enabled));
    res.json(await storage.getPaymentMethodsConfig());
  });

  // ── Integrations status ──────────────────────────────────────────────────
  app.get("/api/admin/integrations/status", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    });
  });

  // ── Admin: CashApp tag setting ────────────────────────────────────────────
  app.get("/api/admin/settings/cashapp-tag", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const tag = await storage.getSetting("cashapp_tag", "");
    res.json({ tag });
  });

  app.post("/api/admin/settings/cashapp-tag", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { tag } = req.body;
    if (typeof tag !== "string") return res.status(400).json({ message: "Invalid tag" });
    await storage.setSetting("cashapp_tag", tag.trim());
    res.json({ tag: tag.trim() });
  });

  // ── Admin: Chime handle setting ────────────────────────────────────────────
  app.get("/api/admin/settings/chime-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const handle = await storage.getSetting("chime_handle", "");
    res.json({ handle });
  });

  app.post("/api/admin/settings/chime-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { handle } = req.body;
    if (typeof handle !== "string") return res.status(400).json({ message: "Invalid handle" });
    await storage.setSetting("chime_handle", handle.trim());
    res.json({ handle: handle.trim() });
  });

  // ── Admin: Zelle handle setting ────────────────────────────────────────────
  app.get("/api/admin/settings/zelle-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const handle = await storage.getSetting("zelle_handle", "");
    res.json({ handle });
  });

  app.post("/api/admin/settings/zelle-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { handle } = req.body;
    if (typeof handle !== "string") return res.status(400).json({ message: "Invalid handle" });
    await storage.setSetting("zelle_handle", handle.trim());
    res.json({ handle: handle.trim() });
  });

  // ── Admin: Venmo handle setting ────────────────────────────────────────────
  app.get("/api/admin/settings/venmo-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const handle = await storage.getSetting("venmo_handle", "");
    res.json({ handle });
  });

  app.post("/api/admin/settings/venmo-handle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { handle } = req.body;
    if (typeof handle !== "string") return res.status(400).json({ message: "Invalid handle" });
    await storage.setSetting("venmo_handle", handle.trim());
    res.json({ handle: handle.trim() });
  });

  // ── Admin: Min deposit per payment method ──────────────────────────────────
  app.get("/api/admin/settings/min-deposits", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const [cashapp, venmo, zelle, chime, crypto] = await Promise.all([
      storage.getSetting("min_deposit_cashapp", "0"),
      storage.getSetting("min_deposit_venmo", "0"),
      storage.getSetting("min_deposit_zelle", "0"),
      storage.getSetting("min_deposit_chime", "0"),
      storage.getSetting("min_deposit_crypto", "0"),
    ]);
    res.json({ cashapp: parseFloat(cashapp), venmo: parseFloat(venmo), zelle: parseFloat(zelle), chime: parseFloat(chime), crypto: parseFloat(crypto) });
  });

  app.post("/api/admin/settings/min-deposits", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const { method, min } = req.body;
    if (!["cashapp", "venmo", "zelle", "chime", "crypto"].includes(method) || typeof min !== "number" || min < 0) {
      return res.status(400).json({ message: "Invalid request" });
    }
    await storage.setSetting(`min_deposit_${method}`, String(min));
    res.json({ ok: true });
  });

  // ── Public: min deposits (for deposit page) ────────────────────────────────
  app.get("/api/site-settings/min-deposits", async (_req, res) => {
    const [cashapp, venmo, zelle, chime, crypto] = await Promise.all([
      storage.getSetting("min_deposit_cashapp", "0"),
      storage.getSetting("min_deposit_venmo", "0"),
      storage.getSetting("min_deposit_zelle", "0"),
      storage.getSetting("min_deposit_chime", "0"),
      storage.getSetting("min_deposit_crypto", "0"),
    ]);
    res.json({ cashapp: parseFloat(cashapp), venmo: parseFloat(venmo), zelle: parseFloat(zelle), chime: parseFloat(chime), crypto: parseFloat(crypto) });
  });

  // ── Public: manual payment methods config (for deposit page) ─────────────
  app.get("/api/site-settings/manual-payments", async (req, res) => {
    const [methods, cashappTag, chimeHandle, zelleHandle, venmoHandle,
           cashappFee, chimeFee, zelleFee] = await Promise.all([
      storage.getPaymentMethodsConfig(),
      storage.getSetting("cashapp_tag", ""),
      storage.getSetting("chime_handle", ""),
      storage.getSetting("zelle_handle", ""),
      storage.getSetting("venmo_handle", ""),
      storage.getSetting("cashapp_fee", "0"),
      storage.getSetting("chime_fee", "0"),
      storage.getSetting("zelle_fee", "0"),
    ]);
    res.json({
      cashapp: { enabled: methods.cashapp !== false, tag: cashappTag, fee: parseFloat(cashappFee) || 0 },
      chime:   { enabled: methods.chime === true,   handle: chimeHandle, fee: parseFloat(chimeFee) || 0 },
      zelle:   { enabled: methods.zelle === true,   handle: zelleHandle, fee: parseFloat(zelleFee) || 0 },
      venmo:   { enabled: (methods as any).venmo === true, handle: venmoHandle, fee: 0 },
    });
  });

  // ── Admin: payment method fee settings ───────────────────────────────────
  for (const method of ["cashapp", "chime", "zelle"]) {
    app.get(`/api/admin/settings/${method}-fee`, async (req, res) => {
      if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
      const fee = await storage.getSetting(`${method}_fee`, "0");
      res.json({ fee: parseFloat(fee) || 0 });
    });
    app.post(`/api/admin/settings/${method}-fee`, async (req, res) => {
      if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.status(401).json({ message: "Unauthorized" });
      const val = Math.max(0, Math.min(100, parseFloat(req.body.fee) || 0));
      await storage.setSetting(`${method}_fee`, String(val));
      res.json({ fee: val });
    });
  }


  // ── CashApp order (checkout) + deposit ───────────────────────────────────
  app.get("/api/site-settings/cashapp-tag", async (req, res) => {
    const tag = await storage.getSetting("cashapp_tag", "");
    res.json({ tag });
  });

  function generateNote(): string {
    const words = ["Fuel", "Gas", "Snack", "Food", "Lunch", "Coffee"];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(1000 + Math.random() * 89000);
    return `${word} - ${num}`;
  }

  app.post("/api/orders/cashapp", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    let pendingOrderId: number | null = null;
    try {
      const userId = (req.user as any).id;
      const { items, amount } = req.body;
      const productItems = (items || []).filter((i: any) => !i.cardId && i.variantId > 0);
      const paymentNote = generateNote();
      const cashappTag = await storage.getSetting("cashapp_tag", "");

      // Deposit-only mode: user specifies how much they want to deposit
      if (productItems.length === 0) {
        const depositAmount = amount ? Math.round(parseFloat(String(amount)) * 100) : 0;
        const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const [order] = await db.insert(orders).values({
          userId,
          orderId: publicOrderId,
          total: depositAmount,
          paidAmount: 0,
          status: "pending",
          paymentMethod: "CashApp",
          paymentNote,
          deliveryContent: "",
        }).returning();
        return res.status(201).json({ order: { ...order, paymentMethod: "CashApp", paymentNote }, paymentNote, cashappTag });
      }

      // Checkout mode: reserve stock
      const { discountCodeId } = req.body;
      const order = await storage.createPendingOrder(userId, productItems, [], discountCodeId ?? null);
      pendingOrderId = order.id;

      // Apply configured processing fee as a surcharge the buyer pays on top
      const feePct = parseFloat(await storage.getSetting("cashapp_fee", "0")) || 0;
      const feeAmount = Math.round(order.total * feePct / 100);
      const dueTotal = order.total + feeAmount;

      const [updatedOrder] = await db.update(orders)
        .set({ paymentMethod: "CashApp", paymentNote, total: dueTotal })
        .where(eq(orders.id, order.id))
        .returning();
      pendingOrderId = null;
      res.status(201).json({
        order: { ...updatedOrder, paymentMethod: "CashApp", paymentNote },
        paymentNote,
        cashappTag,
        fee: feeAmount,
        feePct,
      });
    } catch (e: any) {
      console.error("CashApp order creation failed:", e);
      if (pendingOrderId != null) { try { await storage.cancelPendingOrder(pendingOrderId as number); } catch {} }
      res.status(400).json({ message: e.message });
    }
  });

  // ── Chime deposit ─────────────────────────────────────────────────────────
  app.post("/api/deposits/chime", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const enabled = await storage.getSetting("payment_method_chime", "false");
      if (enabled !== "true") return res.status(400).json({ message: "Chime deposits are not available" });
      const userId = (req.user as any).id;
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }
      const depositAmount = Math.round(parseFloat(String(amount)) * 100);
      const paymentNote = generateNote();
      const handle = await storage.getSetting("chime_handle", "");
      const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const [order] = await db.insert(orders).values({
        userId, orderId: publicOrderId, total: depositAmount, paidAmount: 0,
        status: "pending", paymentMethod: "Chime", paymentNote, deliveryContent: "",
      }).returning();
      res.status(201).json({ order, paymentNote, handle });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Zelle deposit ─────────────────────────────────────────────────────────
  app.post("/api/deposits/zelle", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const enabled = await storage.getSetting("payment_method_zelle", "false");
      if (enabled !== "true") return res.status(400).json({ message: "Zelle deposits are not available" });
      const userId = (req.user as any).id;
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }
      const depositAmount = Math.round(parseFloat(String(amount)) * 100);
      const paymentNote = generateNote();
      const handle = await storage.getSetting("zelle_handle", "");
      const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const [order] = await db.insert(orders).values({
        userId, orderId: publicOrderId, total: depositAmount, paidAmount: 0,
        status: "pending", paymentMethod: "Zelle", paymentNote, deliveryContent: "",
      }).returning();
      res.status(201).json({ order, paymentNote, handle });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Venmo deposit ──────────────────────────────────────────────────────────
  app.post("/api/deposits/venmo", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const enabled = await storage.getSetting("payment_method_venmo", "true");
      if (enabled !== "true") return res.status(400).json({ message: "Venmo deposits are not available" });
      const userId = (req.user as any).id;
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }
      const depositAmount = Math.round(parseFloat(String(amount)) * 100);
      const paymentNote = generateNote();
      const handle = await storage.getSetting("venmo_handle", "");
      const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const [order] = await db.insert(orders).values({
        userId, orderId: publicOrderId, total: depositAmount, paidAmount: 0,
        status: "pending", paymentMethod: "Venmo", paymentNote, deliveryContent: "",
      }).returning();
      res.status(201).json({ order, paymentNote, handle });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Admin: fulfill CashApp order (Paid) ──────────────────────────────────
  app.post("/api/admin/orders/:id/cashapp-fulfill", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const paidAmount = req.body.paidAmount !== undefined
        ? Math.round(Number(req.body.paidAmount) * 100)
        : undefined;
      const order = await storage.fulfillCashappOrder(Number(req.params.id), paidAmount);
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Admin: push stock to any pending order ────────────────────────────────
  app.post("/api/admin/orders/:id/push-stock", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const order = await storage.fulfillCashappOrder(Number(req.params.id));
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ── Admin: mark order unpaid ──────────────────────────────────────────────
  app.post("/api/admin/orders/:id/mark-unpaid", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const order = await storage.markOrderUnpaid(Number(req.params.id));
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });



  // ── ACH ──────────────────────────────────────────────────────
  app.get("/api/ach", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const { rows } = await db.execute(sql`
      SELECT a.id, a.bank_name, a.balance, a.price, a.is_sold, a.seller_id, a.created_at
      FROM achs a
      WHERE a.is_sold = false
      ORDER BY a.created_at DESC
    `) as any;
    res.json(rows.map((r: any) => ({
      id: r.id, bankName: r.bank_name, balance: r.balance,
      price: r.price, isSold: r.is_sold, sellerId: r.seller_id, createdAt: r.created_at,
    })));
  });

  app.post("/api/ach", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const { bankName, balance, fullItem, price } = req.body;
    if (!bankName || !balance || !fullItem || !price) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const ach = await storage.createAch({
      bankName: String(bankName).trim(),
      balance: String(balance).trim(),
      fullItem: String(fullItem).trim(),
      price: Math.round(parseFloat(String(price)) * 100),
    });
    res.status(201).json(ach);
  });

  app.post("/api/ach/:id/purchase", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const achId = Number(req.params.id);
      const userId = (req.user as any).id;
      const ach = await storage.getAch(achId);
      if (!ach || ach.isSold) return res.status(404).json({ message: "ACH not found or sold" });

      // Apply rank discount
      const rankResult = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), sql`amount > 0`, sql`type IN ('deposit', 'manual_deposit')`));
      const totalDeposited = Number(rankResult[0]?.total ?? 0);
      const rankPct = totalDeposited >= 100000 ? 10 : totalDeposited >= 50000 ? 5 : totalDeposited >= 10000 ? 2 : 0;
      const finalPrice = rankPct > 0 ? Math.max(0, Math.round(ach.price * (1 - rankPct / 100))) : ach.price;

      const user = await storage.getUser(userId);
      if (!user || user.balance < finalPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await storage.updateUserBalance(userId, -finalPrice);
      await storage.createTransaction(userId, -finalPrice, "purchase", `Purchased ACH: ${ach.bankName}`);

      await storage.purchaseAch(achId);

      const publicOrderId = Math.random().toString(36).substring(2, 15);
      const [achOrder] = await db.insert(orders).values({
        userId,
        orderId: `ACH-${publicOrderId}`,
        total: finalPrice,
        paidAmount: finalPrice,
        status: "fulfilled",
        deliveryContent: ach.fullItem,
        paymentMethod: "wallet",
      }).returning();

      // Insert order item so the products tab is populated
      await db.insert(orderItems).values({
        orderId: achOrder.id,
        variantId: null,
        cardId: null,
        itemType: "ach",
        price: ach.price,
        quantity: 1,
      });

      res.json({ success: true, deliveryContent: ach.fullItem });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/admin/ach/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await storage.deleteAch(Number(req.params.id));
    res.json({ success: true });
  });


  // ── SMTP Settings (admin) ──────────────────────────────────────
  app.get("/api/admin/smtp", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const smtp_host = await storage.getSetting("smtp_host", "smtp.gmail.com");
    const smtp_port = await storage.getSetting("smtp_port", "587");
    const smtp_email = await storage.getSetting("smtp_email", "");
    // Never return the password
    const has_password = (await storage.getSetting("smtp_password", "")).length > 0;
    res.json({ smtp_host, smtp_port, smtp_email, has_password });
  });

  app.post("/api/admin/smtp", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { smtp_host, smtp_port, smtp_email, smtp_password } = req.body;
    if (smtp_host) await storage.setSetting("smtp_host", String(smtp_host).trim());
    if (smtp_port) await storage.setSetting("smtp_port", String(smtp_port).trim());
    if (smtp_email) await storage.setSetting("smtp_email", String(smtp_email).trim());
    if (smtp_password) await storage.setSetting("smtp_password", String(smtp_password));
    res.json({ message: "SMTP settings saved" });
  });

  // === SELLER APPLICATIONS ===
  app.get("/api/seller/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const app = await storage.getSellerApplication(userId);
    res.json(app || null);
  });

  app.post("/api/seller/apply", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const existing = await storage.getSellerApplication(userId);
    if (existing && existing.status === "pending") {
      return res.status(400).json({ message: "You already have a pending application" });
    }
    const { note } = req.body;
    const code = "SELL-" + Math.random().toString(36).toUpperCase().slice(2, 8);
    const app = await storage.createSellerApplication(userId, code);
    // store note in the application
    if (note) {
      await db.execute(sql`UPDATE seller_applications SET note = ${String(note)} WHERE id = ${app.id}`);
    }
    res.json({ ok: true });
  });

  app.get("/api/admin/seller-applications", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const apps = await storage.getAllSellerApplications();
    res.json(apps);
  });

  app.post("/api/admin/seller-applications/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await storage.approveSellerApplication(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/seller-applications/:id/reject", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { note } = req.body;
    await storage.rejectSellerApplication(Number(req.params.id));
    if (note) {
      await db.execute(sql`UPDATE seller_applications SET note = ${String(note)} WHERE id = ${Number(req.params.id)}`);
    }
    res.json({ ok: true });
  });

  // === FEATURE FLAGS ===
  app.get("/api/settings/features", async (_req, res) => {
    const checker = await storage.getSetting("feature_checker", "true");
    const reseller = await storage.getSetting("feature_reseller", "true");
    const ranks = await storage.getSetting("feature_ranks", "true");
    const logs = await storage.getSetting("feature_logs", "true");
    const cards = await storage.getSetting("feature_cards", "true");
    res.json({ checker: checker !== "false", reseller: reseller !== "false", ranks: ranks !== "false", logs: logs !== "false", cards: cards !== "false" });
  });

  app.post("/api/admin/settings/features", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { checker, reseller, ranks, logs, cards } = req.body;
    if (checker !== undefined) await storage.setSetting("feature_checker", checker ? "true" : "false");
    if (reseller !== undefined) await storage.setSetting("feature_reseller", reseller ? "true" : "false");
    if (ranks !== undefined) await storage.setSetting("feature_ranks", ranks ? "true" : "false");
    if (logs !== undefined) await storage.setSetting("feature_logs", logs ? "true" : "false");
    if (cards !== undefined) await storage.setSetting("feature_cards", cards ? "true" : "false");
    res.json({ ok: true });
  });

  // === CARD CHECKER ===
  app.post("/api/checker/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const { cards: cardList } = req.body;
    if (!Array.isArray(cardList) || cardList.length === 0) {
      return res.status(400).json({ message: "No cards provided" });
    }

    const costPerCard = 15;
    const totalCost = cardList.length * costPerCard;

    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!dbUser || dbUser.balance < totalCost) {
      return res.status(400).json({ message: `Insufficient balance. Need $${(totalCost / 100).toFixed(2)}, have $${((dbUser?.balance ?? 0) / 100).toFixed(2)}` });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ message: "Card checker not configured. Contact admin." });

    await db.update(users).set({ balance: sql`balance - ${totalCost}` }).where(eq(users.id, userId));
    await db.insert(transactions).values({
      userId, amount: -totalCost, type: "purchase",
      description: `Card checker — ${cardList.length} card${cardList.length !== 1 ? "s" : ""}`,
      paymentMethod: "Wallet",
    });

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const results: any[] = [];
    for (const card of cardList) {
      try {
        const num = String(card.number ?? "").replace(/[\s\-]/g, "");
        const dateRaw = String(card.date ?? "").replace(/\//g, "").trim();
        const cvv = String(card.cvv ?? "").trim();

        let expMonth: number, expYear: number;
        if (dateRaw.length === 4) { expMonth = parseInt(dateRaw.slice(0, 2)); expYear = 2000 + parseInt(dateRaw.slice(2)); }
        else if (dateRaw.length === 6) { expMonth = parseInt(dateRaw.slice(0, 2)); expYear = parseInt(dateRaw.slice(2)); }
        else throw new Error("Invalid date format (use MM/YY)");

        const pm = await stripe.paymentMethods.create({ type: "card", card: { number: num, exp_month: expMonth, exp_year: expYear, cvc: cvv } } as any);
        const pi = await stripe.paymentIntents.create({
          amount: 80, currency: "usd", payment_method: pm.id,
          confirm: true, capture_method: "manual", return_url: "https://nychq.cc",
        } as any);
        if ((pi as any).status === "requires_capture") await stripe.paymentIntents.cancel(pi.id);
        results.push({ number: card.number, date: card.date, cvv: card.cvv, status: "approved" });
      } catch (err: any) {
        const errMsg = err?.raw?.message || err?.message || "Declined";
        results.push({ number: card.number, date: card.date, cvv: card.cvv, status: "declined", error: errMsg });
      }
    }

    res.json({ results, charged: totalCost });
  });

  // === LIVE CHECK (card orders) ===
  app.post("/api/orders/:id/live-check", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const order = await storage.getOrder(Number(req.params.id));
    if (!order || order.userId !== userId) return res.status(404).json({ message: "Order not found" });

    const isCard = (order.orderId ?? "").startsWith("CARD-") || order.items?.some((i: any) => i.itemType === "card");
    if (!isCard) return res.status(400).json({ message: "Not a card order" });

    if (Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000) {
      return res.status(400).json({ message: "Live check window expired (15 minutes after purchase)" });
    }

    const fee = 50;
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!dbUser || dbUser.balance < fee) {
      return res.status(400).json({ message: "Insufficient balance. Live check costs $0.50" });
    }

    let cardContent = order.deliveryContent || "";
    if (!cardContent) {
      const cardItem = order.items?.find((i: any) => i.itemType === "card" && i.card);
      if (cardItem?.card) {
        cardContent = [cardItem.card.cardNumber, cardItem.card.expiry, cardItem.card.cvv].filter(Boolean).join("|");
      }
    }
    if (!cardContent) return res.status(400).json({ message: "No card data found on this order" });

    const parts = cardContent.split(/[|]+/).map((s: string) => s.trim()).filter(Boolean);
    const num = (parts[0] ?? "").replace(/\D/g, "");
    const dateRaw = (parts[1] ?? "").replace(/\//g, "").trim();
    const cvv = (parts[2] ?? "").trim();

    let expMonth: number, expYear: number;
    if (dateRaw.length === 4) { expMonth = parseInt(dateRaw.slice(0, 2)); expYear = 2000 + parseInt(dateRaw.slice(2)); }
    else if (dateRaw.length === 6) { expMonth = parseInt(dateRaw.slice(0, 2)); expYear = parseInt(dateRaw.slice(2)); }
    else return res.status(400).json({ message: "Could not parse card expiry date" });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ message: "Live check not configured. Contact admin." });

    await db.update(users).set({ balance: sql`balance - ${fee}` }).where(eq(users.id, userId));
    await db.insert(transactions).values({
      userId, amount: -fee, type: "purchase",
      description: `Live check fee — ${order.orderId}`, paymentMethod: "Wallet",
    });

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    try {
      const pm = await stripe.paymentMethods.create({ type: "card", card: { number: num, exp_month: expMonth, exp_year: expYear, cvc: cvv } } as any);
      const pi = await stripe.paymentIntents.create({
        amount: 50, currency: "usd", payment_method: pm.id,
        confirm: true, capture_method: "manual", return_url: "https://nychq.cc",
      } as any);
      if ((pi as any).status === "requires_capture") await stripe.paymentIntents.cancel(pi.id);
      return res.json({ live: true, message: "Card is Live! ✅" });
    } catch (err: any) {
      await db.update(users).set({ balance: sql`balance + ${fee}` }).where(eq(users.id, userId));
      await db.insert(transactions).values({
        userId, amount: fee, type: "refund",
        description: `Live check refund — ${order.orderId}`, paymentMethod: "Wallet",
      });
      return res.json({ live: false, message: "Card Declined — $0.50 refunded to your wallet." });
    }
  });

  return httpServer;
}
