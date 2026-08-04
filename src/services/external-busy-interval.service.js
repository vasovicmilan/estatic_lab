import ical from "node-ical";
import externalBusyIntervalRepo from "../repositories/external-busy-interval.repository.js";
import { logInfo } from "../utils/logger.util.js";

// Used by availability.service.js exactly like appointmentService.getBusyIntervals -
// same {startTime, endTime} shape, so the caller can concatenate both lists before
// padding/subtracting, without needing to know one came from Mongo and the other
// from a cached external feed.
export async function getExternalBusyIntervals(employeeId, dayStart, dayEnd) {
  return externalBusyIntervalRepo.findByEmployeeAndRange(employeeId, "sredime", dayStart, dayEnd);
}

// Used at actual booking/reassignment time - buffer padding is applied inside
// externalBusyIntervalRepo.existsOverlapping itself (mirrors
// appointmentService.hasOverlappingAppointment's convention), so callers pass
// the raw candidate window as-is. See findAvailableEmployees/
// getEligibleEmployeeIdsForAppointment in availability.service.js.
export async function hasOverlappingExternalInterval(employeeId, startTime, endTime) {
  return externalBusyIntervalRepo.existsOverlapping(employeeId, "sredime", startTime, endTime);
}

// Fetches + parses one employee's SrediMe ICS feed and reconciles it against
// what's already cached for them. Called by jobs/sredime-jobs.js on a cron
// schedule - never in the request path, so a slow or failing feed here can
// never block a customer looking at the booking page.
export async function syncEmployeeFromIcs(employee) {
  if (!employee?.sredimeIcsUrl) return { synced: 0, removed: 0 };

  const employeeId = employee._id;
  const parsed = await ical.async.fromURL(employee.sredimeIcsUrl);

  const now = new Date();
  const currentUids = [];
  let synced = 0;

  for (const key of Object.keys(parsed)) {
    const entry = parsed[key];
    if (entry.type !== "VEVENT") continue; // skip VTIMEZONE/VCALENDAR metadata entries node-ical also returns
    if (!entry.start || !entry.end || !entry.uid) continue; // malformed entry - nothing usable to store

    // Past events don't affect any future slot calculation, and would otherwise
    // accumulate here forever (the feed doesn't stop listing events that already
    // happened) - skipping them keeps this collection from growing unbounded.
    if (new Date(entry.end) < now) continue;

    currentUids.push(entry.uid);
    await externalBusyIntervalRepo.upsertInterval(employeeId, "sredime", entry.uid, {
      startTime: new Date(entry.start),
      endTime: new Date(entry.end),
      summary: entry.summary || null,
    });
    synced++;
  }

  // Anything cached for this employee whose UID didn't show up in this fetch is
  // either a cancellation on SrediMe's side, or (harmlessly) a past event we just
  // chose to stop tracking above - either way it no longer belongs in the active set.
  const removed = await externalBusyIntervalRepo.deleteStaleIntervals(employeeId, "sredime", currentUids);

  logInfo("SrediMe ICS sync completed for employee", { employeeId: employeeId.toString(), synced, removed });
  return { synced, removed };
}

export default { getExternalBusyIntervals, hasOverlappingExternalInterval, syncEmployeeFromIcs };