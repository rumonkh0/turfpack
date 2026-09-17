import { Telegraf } from "telegraf";
import config from "../../config.js";
import { processMessage } from "../../core/brain.js";

let bot = null;

export function initTelegram() {
  if (!config.telegram.botToken) {
    console.log("⚠️ Telegram: TELEGRAM_BOT_TOKEN not configured in .env, skipping Telegram bot initialization");
    return;
  }

  try {
    bot = new Telegraf(config.telegram.botToken);

    bot.start((ctx) => {
      ctx.reply(
        `🤖 *TurfSlot AI CEO Agent Online!*\n\nI am your automated business intelligence and operational executive assistant. Ask me for real-time financial stats, bookings, turf status, or business insights anytime.\n\n_Example questions:_ \n- "How much revenue did we make this week?"\n- "Are there any unpaid bookings?"\n- "Show me today's turf schedule."`,
        { parse_mode: "Markdown" }
      );
    });

    bot.on("text", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const isAuthorized =
        config.telegramAdminChatIds.length === 0 ||
        config.telegramAdminChatIds.includes(chatId);

      if (!isAuthorized) {
        return ctx.reply(`⛔ Unauthorized chat ID: ${chatId}. Add this chat ID to TELEGRAM_ADMIN_CHAT_IDS in .env to grant access.`);
      }

      console.log(`🤖 [Telegram Admin ${chatId}]: ${ctx.message.text}`);

      try {
        const reply = await processMessage(ctx.message.text, `tg_${chatId}`, "telegram");
        await ctx.reply(reply, { parse_mode: "Markdown" });
      } catch (err) {
        console.error("Telegram processing error:", err);
        await ctx.reply("⚠️ Error processing request: " + err.message);
      }
    });

    bot.launch().then(() => {
      console.log("🤖 Telegram Admin Bot successfully launched and listening");
    }).catch((err) => {
      console.warn("⚠️ Telegram bot launch failed:", err.message);
    });

    process.once("SIGINT", () => bot && bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot && bot.stop("SIGTERM"));
  } catch (err) {
    console.warn("⚠️ Failed to initialize Telegraf:", err.message);
  }
}

/**
 * Send a notification to all admin chat IDs
 */
export async function notifyAdmins(message) {
  if (!bot) return;
  for (const chatId of config.telegramAdminChatIds) {
    try {
      await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (err) {
      console.error(`Failed to send Telegram alert to admin ${chatId}:`, err.message);
    }
  }
}
