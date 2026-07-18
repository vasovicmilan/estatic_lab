import { Telegraf } from "telegraf";
import TELEGRAM_CONFIG from "./telegram.config.js";
import { logInfo, logError } from "../../utils/logger.util.js";

let botInstance = null;

export function initTelegramBot() {
  try {
    if (!TELEGRAM_CONFIG.isEnabled()) {
      logInfo("Telegram bot not configured - skipping");
      return null;
    }

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    bot.catch((err, ctx) => {
      logError("Telegram bot error", err, { updateType: ctx?.updateType, chatId: ctx?.chat?.id });
    });

    // Send /topicid inside any topic in the group (or in General/the main chat) to
    // get the exact values for your .env: TELEGRAM_CHAT_ID and, if you're inside a
    // topic, the TELEGRAM_*_THREAD id for that topic. No topic (General/a plain
    // group) means there's no thread id to show - only the chat id applies there.
    bot.command("topicid", (ctx) => {
      const chatId = ctx.chat?.id;
      const threadId = ctx.message?.message_thread_id;

      const lines = [`💬 <b>Chat ID:</b> <code>${chatId}</code>`];
      if (threadId) {
        lines.push(`🧵 <b>Topic (thread) ID:</b> <code>${threadId}</code>`);
      } else {
        lines.push(`🧵 Ova poruka nije poslata unutar teme (topic) - nema thread ID-a ovde.`);
      }

      return ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    });

    bot.launch();
    logInfo("Telegram bot started");

    botInstance = bot;
    return bot;
  } catch (error) {
    logError("Failed to initialize Telegram bot", error);
    return null;
  }
}

export function getTelegramBot() {
  return botInstance;
}

export async function stopTelegramBot() {
  if (botInstance) {
    await botInstance.stop();
    botInstance = null;
    logInfo("Telegram bot stopped");
  }
}