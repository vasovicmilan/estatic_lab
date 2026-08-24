import { getBookingPolicy } from "../config/runtime-settings.cache.js";
import { getZonedComponents } from "./date.time.util.js";

/**
 * Whether a user (not admin/employee) is still allowed to cancel an appointment
 * themselves - true only if the status is cancellable AND we're still more than
 * the configured cancellation cutoff (see runtime-settings.cache.js's
 * getBookingPolicy - admin-editable, default 24h) away from the start time.
 *
 * Single source of truth for this rule - appointment.service.js's cancelAppointment
 * enforces it server-side, and user.presenter.js uses it to decide whether to even
 * show the "Cancel" button, so the UI never offers an action the server would
 * then reject with a 400.
 */
export function canUserCancelAppointment(status, startTime, now = new Date()) {
  if (!["pending", "confirmed"].includes(status)) return false;
  if (!startTime) return false;

  const hoursUntilStart = (new Date(startTime).getTime() - now.getTime()) / 3600000;
  return hoursUntilStart >= getBookingPolicy().userCancellationCutoffHours;
}

/**
 * How much reschedule flexibility a non-admin actor (user or employee) has
 * right now, based purely on how close we are to the CURRENT appointment's
 * start time (thresholds from runtime-settings.cache.js's getBookingPolicy):
 *
 * - "forbidden"     - status isn't reschedulable, or under the same-day floor -
 *                      too close to touch at all.
 * - "same_day_only" - between the floor and the cutoff - can still move it,
 *                      but only to a new time on the SAME calendar day as the
 *                      current appointment.
 * - "any_day"        - at or beyond the cutoff - full flexibility, any future
 *                      day/time (subject to the normal availability checks a
 *                      fresh booking would go through).
 *
 * Admin bypasses this entirely - see appointment.service.js's
 * rescheduleAppointment, which only calls this for actorRole !== "admin".
 */
export function getRescheduleWindow(status, currentStartTime, now = new Date()) {
  if (!["pending", "confirmed"].includes(status)) return "forbidden";
  if (!currentStartTime) return "forbidden";

  const policy = getBookingPolicy();
  const hoursUntilStart = (new Date(currentStartTime).getTime() - now.getTime()) / 3600000;

  if (hoursUntilStart < policy.rescheduleSameDayFloorHours) return "forbidden";
  if (hoursUntilStart < policy.rescheduleCutoffHours) return "same_day_only";
  return "any_day";
}

/**
 * Whether a proposed NEW start time has enough lead time from right now to be
 * bookable at all - applies universally, including to admin, since it's a
 * baseline sanity/prep-time floor rather than a customer-facing protection.
 */
export function hasMinimumRescheduleLeadTime(newStartTime, now = new Date()) {
  const minutesUntilTarget = (new Date(newStartTime).getTime() - now.getTime()) / 60000;
  return minutesUntilTarget >= getBookingPolicy().rescheduleMinLeadMinutes;
}

/**
 * Whether two timestamps fall on the same calendar day, judged in APP_TIMEZONE
 * (Belgrade), not the server process's own timezone (UTC on this VPS) - was
 * using getFullYear()/getMonth()/getDate() directly, which could disagree with
 * the real Belgrade calendar day for anything within 1-2h of midnight. Used to
 * enforce the "same_day_only" reschedule window.
 */
export function isSameCalendarDay(dateA, dateB) {
  const a = getZonedComponents(dateA);
  const b = getZonedComponents(dateB);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export default { canUserCancelAppointment, getRescheduleWindow, hasMinimumRescheduleLeadTime, isSameCalendarDay };