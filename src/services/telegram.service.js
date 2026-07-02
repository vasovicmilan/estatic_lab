import { getTelegramBot } from "../integrations/telegram/telegram.provider.js";
import TELEGRAM_CONFIG from "../integrations/telegram/telegram.config.js";
import { logInfo, logError } from "../utils/logger.util.js";

export async function sendTelegramMessage(type, text, options = {}) {
  try {
    if (!TELEGRAM_CONFIG.isEnabled()) return null;

    const bot = getTelegramBot();
    if (!bot) {
      logError("Telegram bot not initialized", null, { type });
      return null;
    }

    const chatId = TELEGRAM_CONFIG.getChatId();
    const threadId = TELEGRAM_CONFIG.getThreadId(type);
    if (!chatId) {
      logError("Telegram chat ID not configured", null, { type });
      return null;
    }

    const messageOptions = { parse_mode: "HTML", ...options };
    if (threadId) messageOptions.message_thread_id = threadId;

    const result = await bot.telegram.sendMessage(chatId, text, messageOptions);
    logInfo("Telegram message sent", { type, messageId: result?.message_id });
    return result;
  } catch (error) {
    logError("Failed to send Telegram message", error, { type });
    return null;
  }
}

export default { sendTelegramMessage };