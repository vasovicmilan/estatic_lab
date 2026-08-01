const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function dayOfWeek(date) {
  return DAY_NAMES[date.getDay()];
}

export function timeStringToDate(baseDate, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Whether an employee is actually scheduled to work for the ENTIRE
 * [startTime, endTime) window - not just "do they have a working-hours entry
 * for that day at all", but does at least one of that day's shift blocks
 * fully cover this specific window (an appointment can't start inside a shift
 * and run past the end of it).
 *
 * This is the check that was missing from write-time employee resolution
 * (availability.service.js's findAvailableEmployees and appointment.service.js's
 * reassignAppointment both used to only check for a CONFLICTING APPOINTMENT,
 * never whether the employee was even clocked in) - an employee with zero
 * appointments during a shift they don't work looks "free" by conflict-
 * checking alone, which is wrong. getEmployeeFreeSlotsForDay (the READ path
 * that generates the slots a visitor actually sees) already got this right by
 * only ever generating slots inside working-hours blocks in the first place;
 * this is the same rule, just as a yes/no check instead of a slot generator.
 */
export function isEmployeeWorkingAt(employee, startTime, endTime) {
  const weekday = dayOfWeek(startTime);
  const workingHoursEntry = (employee.workingHours || []).find((wh) => wh.day === weekday);
  if (!workingHoursEntry || !workingHoursEntry.slots?.length) return false;

  return workingHoursEntry.slots.some((slot) => {
    const slotStart = timeStringToDate(startTime, slot.from);
    const slotEnd = timeStringToDate(startTime, slot.to);
    return startTime >= slotStart && endTime <= slotEnd;
  });
}

export default { dayOfWeek, timeStringToDate, isEmployeeWorkingAt };