/**
 * Single source of truth for which Appointment status can move to which other status,
 * and who is allowed to make that transition. Consumed by:
 *  - presenters/admin/appointment/appointment.presenter.js (render only valid action buttons)
 *  - middlewares/validators/appointment.validator.js (reject illegal transitions server-side)
 * Never hardcode this list a second time anywhere else.
 */

export const APPOINTMENT_STATUSES = [
  "pending", // waiting for employee assignment and/or confirmation
  "confirmed", // confirmed by employee/admin/system
  "rejected", // declined by employee/admin/system
  "cancelled", // cancelled by the user (or admin, on their behalf)
  "completed", // the appointment happened
  "no_show", // the appointment was confirmed but the client never arrived
];

// currentStatus -> { role -> [allowed next statuses] }
const TRANSITIONS = {
  pending: {
    admin: ["confirmed", "rejected", "cancelled"],
    employee: ["confirmed", "rejected"],
    user: ["cancelled"],
  },
  confirmed: {
    admin: ["completed", "no_show", "cancelled", "rejected"],
    employee: ["completed", "no_show", "rejected"],
    user: ["cancelled"], // service layer additionally enforces the 24h-before-start rule
  },
  rejected: {
    admin: ["pending"], // admin can reopen a mistakenly rejected appointment
  },
  cancelled: {
    admin: ["pending"], // admin can reinstate
  },
  no_show: {
    admin: ["pending"], // admin can reopen a mistakenly marked no-show
  },
  completed: {
    // terminal - no role can transition out of "completed"
  },
};

export function getAllowedStatuses(currentStatus, role) {
  return TRANSITIONS[currentStatus]?.[role] ?? [];
}

export function canTransition(currentStatus, nextStatus, role) {
  return getAllowedStatuses(currentStatus, role).includes(nextStatus);
}