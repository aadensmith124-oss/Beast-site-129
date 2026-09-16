import { Bot, type Context } from "grammy";
import { log } from "./logger.js";
import {
  bindVouchToken,
  getActiveVouchToken,
  hashImageBuffer,
  submitTelegramVouch,
  VouchError,
} from "./vouches.js";

function getTelegramToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
}

function getContextMatch(ctx: Context): string {
  return (typeof ctx.match === "string" ? ctx.match : ctx.match?.[0] ?? "").trim();
}

function getTelegramIdentity(ctx: Context) {
  return {
    chatId: String(ctx.chat?.id ?? ""),
    userId: String(ctx.from?.id ?? ""),
    username: ctx.from?.username ?? null,
  };
}

function vouchErrorMessage(error: unknown) {
  if (error instanceof VouchError) return error.message;
  return "I couldn't process that right now. Please try again.";
}

async function downloadTelegramFile(bot: Bot, fileId: string, token: string) {
  const file = await bot.api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram did not provide the image path.");

  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error("Telegram could not download the image.");

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 4 * 1024 * 1024) {
    throw new VouchError("INVALID_IMAGE", "That image is larger than 4 MB. Please send a smaller image.");
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 4 * 1024 * 1024) {
    throw new VouchError("INVALID_IMAGE", "That image is larger than 4 MB. Please send a smaller image.");
  }
  return data;
}

function registerVouchHandlers(bot: Bot, token: string) {
  bot.command("start", async (ctx) => {
    const { chatId, userId, username } = getTelegramIdentity(ctx);
    if (!chatId || !userId) return;

    const rawToken = getContextMatch(ctx);
    if (!rawToken) {
      await ctx.reply(
        "Welcome. Open the secure Telegram link from your completed order to submit a vouch for site credit.",
      );
      return;
    }

    try {
      const bound = await bindVouchToken(rawToken, chatId, userId, username);
      await ctx.reply(
        `Order #${bound.orderNumber} is ready.\n\nSend one clear photo of your vouch receipt here. Approved genuine vouches receive $${(bound.rewardAmount / 100).toFixed(2)} in site credit.`,
      );
    } catch (error) {
      await ctx.reply(vouchErrorMessage(error));
    }
  });

  bot.command("cancel", async (ctx) => {
    await ctx.reply("No image was submitted. Return to your order page to create a new secure vouch link.");
  });

  bot.on("message:photo", async (ctx) => {
    const { chatId, userId, username } = getTelegramIdentity(ctx);
    if (!chatId || !userId) return;

    try {
      const activeToken = await getActiveVouchToken(chatId, userId);
      if (!activeToken) {
        await ctx.reply("This vouch link is missing or expired. Return to your order page and create a new one.");
        return;
      }

      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1];
      if (!largestPhoto?.file_id) {
        await ctx.reply("I couldn't read that image. Please send it again as a photo.");
        return;
      }

      const image = await downloadTelegramFile(bot, largestPhoto.file_id, token);
      const imageHash = hashImageBuffer(image);
      const vouch = await submitTelegramVouch({
        telegramChatId: chatId,
        telegramUserId: userId,
        telegramUsername: username,
        telegramFileId: largestPhoto.file_id,
        imageHash,
      });

      await ctx.reply(
        `✅ Vouch received for order #${vouch.order_id}.\n\nIt is now pending admin review. If approved, $${(vouch.reward_amount / 100).toFixed(2)} will be added to your site balance.`,
      );
    } catch (error) {
      await ctx.reply(vouchErrorMessage(error));
    }
  });
}

/**
 * Create the Telegram bot instance for webhook handlers.
 *
 * Webhook deployments must not start long polling. The Vercel endpoint calls
 * handleUpdate on the returned bot for each incoming update.
 */
export function createTelegramBot(): Bot | null {
  const token = getTelegramToken();
  if (!token) {
    log("Telegram bot token not set — bot disabled", "telegram");
    return null;
  }

  const bot = new Bot(token);
  registerVouchHandlers(bot, token);
  bot.catch((error) => {
    console.error("[telegram] bot update failed:", error.error);
  });
  return bot;
}

/**
 * Start long polling for persistent runtimes such as the local app or VM.
 * Vercel initialization explicitly disables background jobs, so this is not
 * called by the serverless handler.
 */
export function startTelegramBot(): Bot | null {
  const bot = createTelegramBot();
  if (!bot) return null;

  bot.start({
    onStart: () => log("Telegram bot started (long polling)", "telegram"),
  }).catch((error) => {
    console.error("[telegram] bot failed to start:", error);
  });

  return bot;
}

