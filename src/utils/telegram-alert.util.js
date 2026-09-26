import telegramService from "../services/telegram.service.js";
import { buildErrorAlertMessage } from "./telegram-message.util.js";

// key -> { lastSent, suppressedCount }. Same error firing repeatedly (e.g. a retry
// loop) only pages once per window instead of once per occurrence. suppressedCount
// tracks how many times THIS key was swallowed by the throttle since it last actually
// fired, so the next alert that does go through can say "this also happened N more
// times" instead of the throttled occurrences vanishing with no trace at all.
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

// Returns { throttled, suppressedCount }. suppressedCount is the number of times
// this exact key was swallowed by the throttle window BEFORE this call - i.e. what
// the caller should report if this call is the one that actually gets through.
// When throttled, this call itself also counts (incremented here) so the very next
// non-throttled call reports an accurate total instead of being off by one.
function checkThrottle(key) {
  const now = Date.now();
  const entry = recentAlerts.get(key);

  if (entry && now - entry.lastSent < THROTTLE_WINDOW_MS) {
    entry.suppressedCount += 1;
    return { throttled: true, suppressedCount: entry.suppressedCount };
  }

  const suppressedCount = entry?.suppressedCount || 0;
  // Same eager-set-before-the-global-rate-limit-check timing as before this change -
  // this window is keyed on "was this distinct message allowed past its own 5-minute
  // throttle", independent of whether the global per-minute ceiling then also let it
  // through. The suppressedCount is reset to 0 here (not after the send) since a
  // fresh throttle window has started for this key regardless of what happens next.
  recentAlerts.set(key, { lastSent: now, suppressedCount: 0 });
  return { throttled: false, suppressedCount };
}

// Bounded cleanup so recentAlerts doesn't grow forever across a long-running process
setInterval(() => {
  const cutoff = Date.now() - THROTTLE_WINDOW_MS;
  for (const [key, entry] of recentAlerts) {
    if (entry.lastSent < cutoff) recentAlerts.delete(key);
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
    const { throttled, suppressedCount } = checkThrottle(key);
    if (throttled) return;
    if (!withinRateLimit()) return;

    const text = buildErrorAlertMessage(message, context, suppressedCount);
    await telegramService.sendTelegramMessage("ERRORS", text);
  } catch (err) {
    console.error("[telegram-alert] Failed to send error alert:", err);
  }
}

export default { alertError };