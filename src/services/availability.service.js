import * as employeeRepo from "../repositories/employee.repository.js";
import * as appointmentRepo from "../repositories/appointment.repository.js";
import * as serviceService from "./service.service.js";
import { validationError, badRequest } from "../utils/error.util.js";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function dayOfWeek(date) {
  return DAY_NAMES[date.getDay()];
}

function timeStringToDate(baseDate, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function dayBounds(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Subtracts busy intervals from one working-hour interval, returning the free
 * sub-intervals that remain. Both inputs are {start, end} Date pairs.
 */
function subtractBusyIntervals(freeInterval, busyIntervals) {
  let remaining = [freeInterval];

  for (const busy of busyIntervals) {
    const next = [];
    for (const interval of remaining) {
      // no overlap — interval survives untouched
      if (busy.end <= interval.start || busy.start >= interval.end) {
        next.push(interval);
        continue;
      }
      // overlap — keep the piece(s) of `interval` not covered by `busy`
      if (busy.start > interval.start) {
        next.push({ start: interval.start, end: new Date(Math.min(busy.start, interval.end)) });
      }
      if (busy.end < interval.end) {
        next.push({ start: new Date(Math.max(busy.end, interval.start)), end: interval.end });
      }
    }
    remaining = next;
  }

  return remaining;
}

/**
 * Steps through a free interval in `durationMinutes` increments, keeping only steps
 * that fully fit before the interval's end.
 */
function sliceIntoSlots(interval, durationMinutes) {
  const slots = [];
  const stepMs = durationMinutes * 60000;
  let cursor = new Date(interval.start);

  while (cursor.getTime() + stepMs <= interval.end.getTime()) {
    const slotEnd = new Date(cursor.getTime() + stepMs);
    slots.push({ startTime: new Date(cursor), endTime: slotEnd });
    cursor = slotEnd;
  }

  return slots;
}

async function getEmployeeFreeSlotsForDay(employee, date, durationMinutes) {
  const weekday = dayOfWeek(date);
  const workingHoursEntry = (employee.workingHours || []).find((wh) => wh.day === weekday);
  if (!workingHoursEntry || !workingHoursEntry.slots?.length) return [];

  const { start: dayStart, end: dayEnd } = dayBounds(date);
  const busyRaw = await appointmentRepo.findBusyIntervals(employee._id, dayStart, dayEnd);
  const busyIntervals = busyRaw.map((a) => ({ start: new Date(a.startTime), end: new Date(a.endTime) }));

  const allSlots = [];
  for (const workSlot of workingHoursEntry.slots) {
    const workInterval = { start: timeStringToDate(date, workSlot.from), end: timeStringToDate(date, workSlot.to) };
    const freeSubIntervals = subtractBusyIntervals(workInterval, busyIntervals);
    for (const free of freeSubIntervals) {
      allSlots.push(...sliceIntoSlots(free, durationMinutes));
    }
  }

  return allSlots.map((s) => ({ ...s, employeeId: employee._id.toString() }));
}

/**
 * Returns available slots for a service variant on a given day.
 * - `employeeId` given: slots for that one employee only.
 * - `employeeId` omitted: slots merged across every employee who can perform the
 *   service, deduplicated by start time (so "9:00, 9:30, 10:00..." shows once even if
 *   multiple therapists are free then) — each entry keeps the list of employee ids
 *   actually free at that time, for auto-assignment at booking time.
 */
export async function getAvailableSlots({ serviceId, servicePackageId, employeeId = null, date }) {
  if (!serviceId) validationError("serviceId");
  if (!servicePackageId) validationError("servicePackageId");
  if (!date) validationError("date");

  const targetDate = date instanceof Date ? date : new Date(date);
  if (isNaN(targetDate.getTime())) badRequest("Neispravan datum");
  if (targetDate < new Date(new Date().setHours(0, 0, 0, 0))) badRequest("Ne možete zakazati termin u prošlosti");

  const { variant } = await serviceService.getActiveVariant(serviceId, servicePackageId);

  const candidates = employeeId
    ? [await employeeRepo.findEmployeeById(employeeId)].filter(Boolean)
    : await employeeRepo.findEmployeesByService(serviceId);

  if (!candidates.length) return [];

  const perEmployeeSlots = await Promise.all(
    candidates.map((employee) => getEmployeeFreeSlotsForDay(employee, targetDate, variant.duration))
  );

  const flat = perEmployeeSlots.flat();

  if (employeeId) {
    return flat.sort((a, b) => a.startTime - b.startTime);
  }

  // merge by identical start time across employees
  const byStart = new Map();
  for (const slot of flat) {
    const key = slot.startTime.toISOString();
    if (!byStart.has(key)) {
      byStart.set(key, { startTime: slot.startTime, endTime: slot.endTime, employeeIds: [slot.employeeId] });
    } else {
      byStart.get(key).employeeIds.push(slot.employeeId);
    }
  }

  return [...byStart.values()].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Write-time resolution — given a chosen start time and no specific employee
 * preference, picks the first candidate who is (still) actually free right now. Used
 * inside the booking transaction as the final source of truth, since the slot list the
 * visitor saw may be a few seconds stale.
 */
export async function findFirstAvailableEmployee(serviceId, startTime, endTime, { session } = {}) {
  const candidates = await employeeRepo.findEmployeesByService(serviceId, { session });
  for (const employee of candidates) {
    const overlapping = await appointmentRepo.findOverlappingAppointments(employee._id, startTime, endTime, null, { session });
    if (overlapping.length === 0) return employee;
  }
  return null;
}

export default { getAvailableSlots, findFirstAvailableEmployee };