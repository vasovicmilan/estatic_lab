// "YYYY-MM-DD" in the server's LOCAL timezone - deliberately NOT date.toISOString(),
// which converts to UTC first and silently shifts the date whenever the server isn't
// running in UTC. pino-roll's rotated log filenames are stamped using local time (see
// logger.config.js), so anything matching a date against those filenames (see
// log-analysis.util.js / log-report.service.js) needs to compute "today"/"yesterday"
// the same local-time way, or the dates just won't line up.
export function toDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year}. ${hours}:${minutes}`;
}

export function formatDate(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}.${month}.${year}.`;
}

export function formatDateForInput(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateTimeForInput(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hours = "00", minutes = "00"] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  }

  const srMatch = input.match(/^(\d{2})\.(\d{2})\.(\d{4})\.?(?:\s+(\d{2}):(\d{2}))?/);
  if (srMatch) {
    const [, day, month, year, hours = "00", minutes = "00"] = srMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  }

  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function isValidDate(date) {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

// The app's single "business" timezone - matches scheduler.js's CRON_TIMEZONE,
// since a scheduledFor value entered by an admin and the cron sweep that fires
// on it need to agree on what wall-clock time actually means.
const APP_TIMEZONE = process.env.CRON_TIMEZONE || "Europe/Belgrade";

// Converts a naive "YYYY-MM-DDTHH:mm[:ss]" string - exactly what an
// <input type="datetime-local"> submits, with NO timezone info attached -
// into the real UTC instant it represents in `timeZone` (default: the app's
// business timezone). Deliberately does NOT hand the raw string to `new
// Date()`/Mongoose's Date caster: per the ECMA-262 Date Time String Format, a
// string with a time component but no offset is parsed using the *server
// process's own local time* - correct only by coincidence if that happens to
// match `timeZone`. On a typical Ubuntu VPS running with system time in UTC,
// that silently reinterprets "14:00 Belgrade" as "14:00 UTC", shifting the
// real publish instant 1-2h later (CET/CEST) than the admin intended - which
// is how a scheduled blog post can sail past the time shown on screen without
// the publish-scheduled-posts cron ever picking it up as due.
export function zonedInputToUtcDate(input, timeZone = APP_TIMEZONE) {
  if (!input) return null;
  const match = String(input).trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;

  // Two-step correction: first take the wall-clock digits as if they were
  // already UTC, ask what that UTC instant displays as inside `timeZone`,
  // then shift by however far off that turned out to be. One pass is enough
  // for every real-world zone (no zone's DST transition moves the instant by
  // more than a couple of hours), so this converges without needing a
  // timezone database dependency.
  const asUTC = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(asUTC)).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfUtcWereZoned = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asIfUtcWereZoned - asUTC;
  return new Date(asUTC - offset);
}

// Inverse of zonedInputToUtcDate - formats a stored UTC Date back into the
// "YYYY-MM-DDTHH:mm" wall-clock string `timeZone` would show, for pre-filling
// a <input type="datetime-local"> on the edit form. Without this, the raw
// Date object was being stringified with the default toString() (e.g. "Wed
// Jul 29 2026 14:00:00 GMT+0000..."), which datetime-local inputs can't parse
// and silently render blank.
export function utcDateToZonedInputValue(date, timeZone = APP_TIMEZONE) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default {
  formatDateTime,
  formatDate,
  formatDateForInput,
  formatDateTimeForInput,
  parseDate,
  isValidDate,
  zonedInputToUtcDate,
  utcDateToZonedInputValue,
};