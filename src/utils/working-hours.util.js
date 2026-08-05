import { zonedComponentsToUtcDate, getZonedComponents } from "./date.time.util.js";

export function dayOfWeek(date) {
  // Was date.getDay() - reads the SERVER PROCESS's own timezone (UTC on this
  // VPS), not Belgrade. Near midnight the two calendars can genuinely disagree
  // (e.g. 00:30 Belgrade in winter is still 23:30 UTC the PREVIOUS day), which
  // silently matched an appointment against the wrong day's working-hours
  // entry. getZonedComponents resolves the weekday the same Belgrade-correct
  // way every other date calculation in this app now does.
  return getZonedComponents(date).weekday;
}

export function timeStringToDate(baseDate, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  // Was `new Date(baseDate); d.setHours(hours, minutes, 0, 0)` - setHours()
  // sets the hour/minute in the SERVER PROCESS's own timezone, so a working-hours
  // entry of "09:00" was silently being placed at 09:00 UTC (11:00 Belgrade in
  // summer, 10:00 in winter) instead of the intended 09:00 Belgrade wall-clock
  // time. This is the root cause behind slots/working-hours/appointments
  // appearing shifted by 1-2h everywhere the value was later compared against
  // a real-world instant (Google Calendar, the customer's own clock, etc).
  // baseDate only supplies which CALENDAR DAY (in Belgrade) hhmm applies to -
  // read via getZonedComponents so that's also correct near midnight.
  const { year, month, day } = getZonedComponents(baseDate);
  return zonedComponentsToUtcDate(year, month, day, hours, minutes, 0);
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