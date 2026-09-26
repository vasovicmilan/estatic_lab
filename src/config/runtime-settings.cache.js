import siteSettingsRepo from "../repositories/site-settings.repository.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { DAYS_OF_WEEK } from "../utils/working-hours.util.js";
import { getZonedComponents } from "../utils/date.time.util.js";

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
  commissionPolicy: {
    minimumSessionCommission: 500,
  },
  // Mirrors site-settings.model.js's defaultWorkingHours() - unconfigured
  // (every day isOpen: false) is the correct pre-load fallback too, since
  // hasFixedWorkingHours() below treats "all closed" as "not set yet" and
  // organization.builder.js falls back to the derived employee-aggregate
  // hours in exactly that case.
  workingHours: DAYS_OF_WEEK.map((day) => ({ day, isOpen: false, from: "09:00", to: "20:00" })),
  closedDates: [],
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
      commissionPolicy: {
        minimumSessionCommission: settings.commissionPolicy?.minimumSessionCommission ?? cache.commissionPolicy.minimumSessionCommission,
      },
      // Stored as plain objects (not mongoose subdocuments) so isDateClosed/
      // hasFixedWorkingHours below never accidentally depend on mongoose
      // document behavior (toObject, getters, etc).
      workingHours:
        settings.workingHours?.length
          ? settings.workingHours.map((wh) => ({ day: wh.day, isOpen: !!wh.isOpen, from: wh.from, to: wh.to }))
          : cache.workingHours,
      closedDates: (settings.closedDates || []).map((cd) => ({
        date: cd.date,
        reason: cd.reason || "",
        recurringYearly: !!cd.recurringYearly,
      })),
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

export function getCommissionPolicy() {
  return cache.commissionPolicy;
}

// The salon-wide DISPLAY schedule (contact page, footer, SEO) - see
// site-settings.model.js's WorkingHoursDaySchema. NEVER used by
// availability.service.js's slot generation - that stays on
// Employee.workingHours exclusively (isEmployeeWorkingAt/getEmployeeFreeSlotsForDay).
export function getWorkingHours() {
  return cache.workingHours;
}

export function getClosedDates() {
  return cache.closedDates;
}

// True once an admin has opened at least one day in the fixed schedule -
// the "unconfigured" sentinel is every day defaulting to isOpen: false (see
// site-settings.model.js's defaultWorkingHours). organization.builder.js
// uses this to decide whether to trust the fixed schedule for JSON-LD or
// keep deriving hours from actual employee shifts as it always has.
export function hasFixedWorkingHours() {
  return cache.workingHours.some((wh) => wh.isOpen);
}

/**
 * Whether `date` (compared by its Europe/Belgrade calendar day - same zone
 * every other scheduling calculation in this app uses, see date.time.util.js)
 * falls on a salon-wide closed date. A `recurringYearly` entry matches every
 * year on the same month/day regardless of the year actually stored in
 * `date` (e.g. one "1. januar" row closes every New Year's Day forever); a
 * non-recurring entry matches only that exact calendar date.
 *
 * Reads the in-memory cache only - no DB query - so
 * availability.service.js can call this once per requested day without
 * paying a per-employee (or per-slot) database round trip.
 */
export function isDateClosed(date) {
  const target = getZonedComponents(date);
  return cache.closedDates.some((closed) => {
    const closedComponents = getZonedComponents(closed.date);
    if (closed.recurringYearly) {
      return closedComponents.month === target.month && closedComponents.day === target.day;
    }
    return (
      closedComponents.year === target.year &&
      closedComponents.month === target.month &&
      closedComponents.day === target.day
    );
  });
}

export default {
  loadRuntimeSettings,
  getBookingPolicy,
  getCurrency,
  getCommissionPolicy,
  getWorkingHours,
  getClosedDates,
  hasFixedWorkingHours,
  isDateClosed,
};