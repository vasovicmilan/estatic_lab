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