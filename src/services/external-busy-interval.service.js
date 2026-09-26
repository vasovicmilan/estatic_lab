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

// node-ical's async.fromURL spreads its options object straight into the
// fetch() call it makes internally (see node_modules/node-ical/lib/core-api.js),
// so a standard AbortSignal is how a caller applies a timeout to it - there's
// no separate library-level timeout option to reach for. Without this, one
// employee's slow/unresponsive SrediMe feed would hang the fetch's underlying
// TCP connection indefinitely (a hang, not a rejection - try/catch around the
// call can't do anything about it, only a signal that actually aborts the
// in-flight request can), and since jobs/sredime-jobs.js runs this cron tick
// every 15 minutes, a single bad feed left unbounded could block that whole
// tick, not just that one employee's sync.
const ICS_FETCH_TIMEOUT_MS = 15_000;

// Fetches + parses one employee's SrediMe ICS feed and reconciles it against
// what's already cached for them. Called by jobs/sredime-jobs.js on a cron
// schedule - never in the request path, so a slow or failing feed here can
// never block a customer looking at the booking page. jobs/sredime-jobs.js's
// runSredimeSync already isolates each employee's call in its own try/catch, so
// a timeout here surfaces as an ordinary per-employee failure (logged +
// alerted, loop continues) rather than anything special-cased in this
// function - the timeout's whole job is making sure the *hang* itself can't
// happen, not handling the resulting error.
export async function syncEmployeeFromIcs(employee) {
  if (!employee?.sredimeIcsUrl) return { synced: 0, removed: 0 };

  const employeeId = employee._id;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), ICS_FETCH_TIMEOUT_MS);
  let parsed;
  try {
    parsed = await ical.async.fromURL(employee.sredimeIcsUrl, { signal: abortController.signal });
  } finally {
    clearTimeout(timeoutHandle);
  }

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