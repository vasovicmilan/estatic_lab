import { getStartOfDayInZone, nextDayStartInZone } from "./date.time.util.js";

/**
 * The "Vreme" filter of the admin appointment list: Danas (today), Predstojeći (after today) and
 * Prošli (before today) - the same three buckets the customer's and the employee's own lists use.
 * Bounds are Belgrade calendar-day boundaries (dateFrom inclusive, dateTo exclusive, matching
 * appointment.filter.js). Anything else (including "") means "no restriction".
 */
export const TIME_SCOPES = ["today", "upcoming", "past"];

export function resolveTimeScope(scope, now = new Date()) {
  const startOfToday = getStartOfDayInZone(now);
  const startOfTomorrow = nextDayStartInZone(now);
  switch (scope) {
    case "today":
      return { dateFrom: startOfToday, dateTo: startOfTomorrow, sort: { startTime: 1, _id: 1 } };
    case "upcoming":
      return { dateFrom: startOfTomorrow, dateTo: undefined, sort: { startTime: 1, _id: 1 } };
    case "past":
      return { dateFrom: undefined, dateTo: startOfToday, sort: { startTime: -1, _id: -1 } };
    default:
      return null;
  }
}

/** Intersects the scope's bounds with explicit admin-chosen dates (the tighter bound wins). */
export function applyTimeScope({ scope, dateFrom, dateTo, now = new Date() }) {
  const s = resolveTimeScope(scope, now);
  if (!s) return { dateFrom, dateTo, sort: undefined };
  const maxDate = (a, b) => (a && b ? (a > b ? a : b) : a || b);
  const minDate = (a, b) => (a && b ? (a < b ? a : b) : a || b);
  return { dateFrom: maxDate(dateFrom, s.dateFrom), dateTo: minDate(dateTo, s.dateTo), sort: s.sort };
}
