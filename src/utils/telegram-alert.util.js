import telegramService from "../services/telegram.service.js";
import { buildErrorAlertMessage } from "./telegram-message.util.js";

// key -> last-sent timestamp (ms). Same error firing repeatedly (e.g. a retry loop)
// only pages once per window instead of once per occurrence.
const recentAlerts = new Map();
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes per distinct error

// hard ceiling on total alerts sent in a rolling minute, regardless of how many
// distinct error messages are involved - the last line of defense against a genuine
// flood (e.g. a dependency outage causing many different error messages at once)
const MAX_ALERTS_PER_MINUTE = 5;
let windowStart = Date.now();
let windowCount = 0;

function keyFor(message) {
  return String(message).slice(0, 200);
}

function withinRateLimit() {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_ALERTS_PER_MINUTE) return false;
  windowCount += 1;
  return true;
}

function shouldThrottle(key) {
  const last = recentAlerts.get(key);
  const now = Date.now();
  if (last && now - last < THROTTLE_WINDOW_MS) return true;
  recentAlerts.set(key, now);
  return false;
}

// Bounded cleanup so recentAlerts doesn't grow forever across a long-running process
setInterval(() => {
  const cutoff = Date.now() - THROTTLE_WINDOW_MS;
  for (const [key, ts] of recentAlerts) {
    if (ts < cutoff) recentAlerts.delete(key);
  }
}, THROTTLE_WINDOW_MS).unref();

/**
 * Sends an error alert to the Telegram ERRORS thread. Never throws, never calls
 * logError (see module comment) - failures here only reach console.error, which is
 * a dead end, not a loop.
 */
export async function alertError(message, context = {}) {
  try {
    const key = keyFor(message);
    if (shouldThrottle(key)) return;
    if (!withinRateLimit()) return;

    const text = buildErrorAlertMessage(message, context);
    await telegramService.sendTelegramMessage("ERRORS", text);
  } catch (err) {
    console.error("[telegram-alert] Failed to send error alert:", err);
  }
}

export default { alertError };