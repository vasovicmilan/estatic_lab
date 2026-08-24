import siteSettingsRepo from "../repositories/site-settings.repository.js";
import { logInfo, logError } from "../utils/logger.util.js";

// Defaults mirror the schema defaults in site-settings.model.js exactly - this
// is the fallback used only in the narrow window before the first
// loadRuntimeSettings() call resolves (see server.js) or if that load ever
// fails, so the app degrades to the previous hardcoded booking.config.js
// behavior rather than to zeros/undefined.
let cache = {
  bookingPolicy: {
    bufferMinutes: 30,
    slotGridMinutes: 30,
    userCancellationCutoffHours: 24,
    rescheduleCutoffHours: 24,
    rescheduleSameDayFloorHours: 4,
    rescheduleMinLeadMinutes: 30,
  },
  currency: {
    code: "RSD",
    symbol: "RSD",
    symbolPosition: "after",
  },
};

/**
 * Populates the cache from the database. Called once at server startup
 * (server.js, after the DB connects) and again by site-settings.service.js
 * right after an admin saves a change, so edits take effect immediately
 * without a restart. Never throws - a failed load just means the previous
 * (or default) cached values keep being used, since booking/pricing must
 * keep working even if this one read fails.
 */
export async function loadRuntimeSettings() {
  try {
    const settings = await siteSettingsRepo.findOrCreateSiteSettings();
    cache = {
      bookingPolicy: {
        bufferMinutes: settings.bookingPolicy?.bufferMinutes ?? cache.bookingPolicy.bufferMinutes,
        slotGridMinutes: settings.bookingPolicy?.slotGridMinutes ?? cache.bookingPolicy.slotGridMinutes,
        userCancellationCutoffHours: settings.bookingPolicy?.userCancellationCutoffHours ?? cache.bookingPolicy.userCancellationCutoffHours,
        rescheduleCutoffHours: settings.bookingPolicy?.rescheduleCutoffHours ?? cache.bookingPolicy.rescheduleCutoffHours,
        rescheduleSameDayFloorHours: settings.bookingPolicy?.rescheduleSameDayFloorHours ?? cache.bookingPolicy.rescheduleSameDayFloorHours,
        rescheduleMinLeadMinutes: settings.bookingPolicy?.rescheduleMinLeadMinutes ?? cache.bookingPolicy.rescheduleMinLeadMinutes,
      },
      currency: {
        code: settings.currency?.code || cache.currency.code,
        symbol: settings.currency?.symbol || cache.currency.symbol,
        symbolPosition: settings.currency?.symbolPosition || cache.currency.symbolPosition,
      },
    };
    logInfo("Runtime settings loaded", cache);
  } catch (error) {
    logError("[loadRuntimeSettings] Failed to load - keeping previous/default values", error);
  }
}

export function getBookingPolicy() {
  return cache.bookingPolicy;
}

export function getCurrency() {
  return cache.currency;
}

export default { loadRuntimeSettings, getBookingPolicy, getCurrency };