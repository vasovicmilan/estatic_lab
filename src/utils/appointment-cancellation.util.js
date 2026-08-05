import {
  USER_CANCELLATION_CUTOFF_HOURS,
  RESCHEDULE_CUTOFF_HOURS,
  RESCHEDULE_SAME_DAY_FLOOR_HOURS,
  RESCHEDULE_MIN_LEAD_MINUTES,
} from "../config/booking.config.js";

/**
 * Whether a user (not admin/employee) is still allowed to cancel an appointment
 * themselves - true only if the status is cancellable AND we're still more than
 * USER_CANCELLATION_CUTOFF_HOURS away from the start time.
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
  return hoursUntilStart >= USER_CANCELLATION_CUTOFF_HOURS;
}

/**
 * How much reschedule flexibility a non-admin actor (user or employee) has
 * right now, based purely on how close we are to the CURRENT appointment's
 * start time:
 *
 * - "forbidden"     - status isn't reschedulable, or under RESCHEDULE_SAME_DAY_FLOOR_HOURS
 *                      away - too close to touch at all.
 * - "same_day_only" - between the floor and RESCHEDULE_CUTOFF_HOURS away - can
 *                      still move it, but only to a new time on the SAME
 *                      calendar day as the current appointment.
 * - "any_day"        - RESCHEDULE_CUTOFF_HOURS or more away - full flexibility,
 *                      any future day/time (subject to the normal availability
 *                      checks a fresh booking would go through).
 *
 * Admin bypasses this entirely - see appointment.service.js's
 * rescheduleAppointment, which only calls this for actorRole !== "admin".
 */
export function getRescheduleWindow(status, currentStartTime, now = new Date()) {
  if (!["pending", "confirmed"].includes(status)) return "forbidden";
  if (!currentStartTime) return "forbidden";

  const hoursUntilStart = (new Date(currentStartTime).getTime() - now.getTime()) / 3600000;

  if (hoursUntilStart < RESCHEDULE_SAME_DAY_FLOOR_HOURS) return "forbidden";
  if (hoursUntilStart < RESCHEDULE_CUTOFF_HOURS) return "same_day_only";
  return "any_day";
}

/**
 * Whether a proposed NEW start time has enough lead time from right now to be
 * bookable at all - applies universally, including to admin, since it's a
 * baseline sanity/prep-time floor rather than a customer-facing protection.
 */
export function hasMinimumRescheduleLeadTime(newStartTime, now = new Date()) {
  const minutesUntilTarget = (new Date(newStartTime).getTime() - now.getTime()) / 60000;
  return minutesUntilTarget >= RESCHEDULE_MIN_LEAD_MINUTES;
}

/**
 * Whether two timestamps fall on the same calendar day, judged in server-local
 * time (matching how working hours/slot generation already reason about days
 * elsewhere in the app). Used to enforce the "same_day_only" reschedule window.
 */
export function isSameCalendarDay(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default { canUserCancelAppointment, getRescheduleWindow, hasMinimumRescheduleLeadTime, isSameCalendarDay };