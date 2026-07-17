import { USER_CANCELLATION_CUTOFF_HOURS } from "../config/booking.config.js";

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

export default { canUserCancelAppointment };