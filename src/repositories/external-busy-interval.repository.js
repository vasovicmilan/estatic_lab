import ExternalBusyInterval from "../models/external-busy-interval.model.js";
import { BOOKING_BUFFER_MINUTES } from "../config/booking.config.js";

const BUFFER_MS = BOOKING_BUFFER_MINUTES * 60000;

/**
 * Every external busy interval for one employee within [rangeStart, rangeEnd) -
 * mirrors appointment.repository.js's findBusyIntervals shape exactly, so
 * availability.service.js can pad/subtract both lists the same way.
 */
export async function findByEmployeeAndRange(employeeId, source, rangeStart, rangeEnd) {
  return ExternalBusyInterval.find({
    employee: employeeId,
    source,
    startTime: { $lt: rangeEnd },
    endTime: { $gt: rangeStart },
  })
    .select("startTime endTime")
    .lean();
}

// One event from the parsed feed - matched by the (employee, source,
// externalUid) unique index, so a reschedule on the external side updates the
// same document's start/end instead of creating a duplicate.
export async function upsertInterval(employeeId, source, externalUid, { startTime, endTime, summary }) {
  return ExternalBusyInterval.findOneAndUpdate(
    { employee: employeeId, source, externalUid },
    { startTime, endTime, summary: summary || null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Removes every stored interval for this employee+source whose externalUid is
// NOT in the freshly-parsed feed - this is how a cancellation on the external
// side is detected: its UID simply stops appearing, so its stale row here would
// otherwise keep blocking an actually-free slot forever.
export async function deleteStaleIntervals(employeeId, source, currentUids) {
  const result = await ExternalBusyInterval.deleteMany({
    employee: employeeId,
    source,
    externalUid: { $nin: currentUids },
  });
  return result.deletedCount || 0;
}

// Used when an employee's sredimeIcsUrl is removed/cleared - without this, a
// stale set of intervals from before the disconnect would sit there forever,
// silently blocking slots for a feed nobody is syncing anymore.
export async function deleteAllForEmployee(employeeId, source) {
  const result = await ExternalBusyInterval.deleteMany({ employee: employeeId, source });
  return result.deletedCount || 0;
}

// Used at actual booking/reassignment time (findAvailableEmployees,
// getEligibleEmployeeIdsForAppointment) - a boolean existence check rather than
// findByEmployeeAndRange's full list, since the caller only needs "is this exact
// candidate window blocked," not the shape of every interval that day. Buffer is
// applied here, inside the query, mirroring findOverlappingAppointments'
// convention exactly - callers pass the raw candidate window, not a pre-padded one.
export async function existsOverlapping(employeeId, source, startTime, endTime) {
  const match = await ExternalBusyInterval.exists({
    employee: employeeId,
    source,
    startTime: { $lt: new Date(endTime.getTime() + BUFFER_MS) },
    endTime: { $gt: new Date(startTime.getTime() - BUFFER_MS) },
  });
  return !!match;
}

export default { findByEmployeeAndRange, upsertInterval, deleteStaleIntervals, deleteAllForEmployee, existsOverlapping };