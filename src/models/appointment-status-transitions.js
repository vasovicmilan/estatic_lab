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
];

// currentStatus -> { role -> [allowed next statuses] }
const TRANSITIONS = {
  pending: {
    admin: ["confirmed", "rejected", "cancelled"],
    employee: ["confirmed", "rejected"],
    user: ["cancelled"],
  },
  confirmed: {
    admin: ["completed", "cancelled", "rejected"],
    employee: ["completed", "rejected"],
    user: ["cancelled"], // service layer additionally enforces the 24h-before-start rule
  },
  rejected: {
    admin: ["pending"], // admin can reopen a mistakenly rejected appointment
  },
  cancelled: {
    admin: ["pending"], // admin can reinstate
  },
  completed: {
    // terminal — no role can transition out of "completed"
  },
};

/**
 * @param {string} currentStatus
 * @param {"admin"|"employee"|"user"} role
 * @returns {string[]} statuses this role may transition `currentStatus` into
 */
export function getAllowedStatuses(currentStatus, role) {
  return TRANSITIONS[currentStatus]?.[role] ?? [];
}

/**
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @param {"admin"|"employee"|"user"} role
 * @returns {boolean}
 */
export function canTransition(currentStatus, nextStatus, role) {
  return getAllowedStatuses(currentStatus, role).includes(nextStatus);
}
