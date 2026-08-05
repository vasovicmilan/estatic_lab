export const BOOKING_BUFFER_MINUTES = 30;

// How many hours before an appointment's start time a *user* (not admin/employee)
// can still cancel it themselves. Single source of truth - consumed by both
// appointment.service.js (server-side enforcement) and the user-facing "Cancel"
// button (see utils/appointment-cancellation.util.js) so the UI never offers a
// button the server would then reject.
export const USER_CANCELLATION_CUTOFF_HOURS = 24;

// Reschedule policy - deliberately separate constants from the cancellation
// cutoff above even though the value currently matches, since the two policies
// are conceptually independent and may diverge later (e.g. a business might
// want rescheduling to be easier than outright cancelling).
//
// How close to the CURRENT appointment's start time a user/employee can still
// move it (admin is exempt - see appointment.service.js's rescheduleAppointment).
export const RESCHEDULE_CUTOFF_HOURS = 24;

// Below RESCHEDULE_CUTOFF_HOURS but still at least this many hours out, a
// reschedule is allowed but restricted to the SAME calendar day as the current
// appointment (not a different day) - a middle ground between "plenty of
// notice, move anywhere" and "too close, don't touch it." Below this floor,
// rescheduling isn't allowed at all for a non-admin actor.
export const RESCHEDULE_SAME_DAY_FLOOR_HOURS = 4;

// Minimum notice the NEW time itself must have from right now - deliberately
// flat (no same-day-vs-later distinction) to keep the rule simple: the new
// slot just needs to be a real, bookable moment in the near future, same
// granularity as the booking grid itself.
export const RESCHEDULE_MIN_LEAD_MINUTES = 30;

// Fixed grid for offered start times (09:00, 09:30, 10:00...), independent of
// each service's own duration. Without this, slot start times drift by the
// service's duration (a 45-min service would offer 09:00, 09:45, 10:30... -
// non-round times customers don't expect). 30 min is standard for spa/wellness
// booking; drop to 15 only if you add noticeably short treatments.
export const SLOT_GRID_MINUTES = 30;

export default {
  BOOKING_BUFFER_MINUTES,
  USER_CANCELLATION_CUTOFF_HOURS,
  RESCHEDULE_CUTOFF_HOURS,
  RESCHEDULE_SAME_DAY_FLOOR_HOURS,
  RESCHEDULE_MIN_LEAD_MINUTES,
  SLOT_GRID_MINUTES,
};