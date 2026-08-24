import { getCurrency } from "../config/runtime-settings.cache.js";

/**
 * Formats a monetary amount as a whole number (no decimals) for display -
 * amounts can accumulate fractional RSD from percentage-based commission math
 * (e.g. 10% of 2850 = 285, but 12% of 2850 = 342 exactly, while 11% would be
 * 313.5), and this is the one shared place that rounds them for display,
 * rather than each mapper/presenter needing to remember to do it separately.
 */
export function formatPrice(value) {
  return Math.round(Number(value) || 0);
}

/**
 * formatPrice() plus the admin-configured currency symbol (see
 * runtime-settings.cache.js's getCurrency, admin-editable at /admin/sajt) in
 * the right position - "2500 RSD" by default, but "€2500" for a client billing
 * in EUR without any code change. This does NOT convert between currencies or
 * change what's stored in the database - every price in Mongo is still a
 * plain number in one implicit currency per deployment; this only controls
 * how that number is displayed. Replaces the old convention of every mapper/
 * presenter/template writing `${formatPrice(x)} RSD` by hand, which is why a
 * currency change used to mean hunting down dozens of hardcoded " RSD"
 * strings across the codebase instead of editing one admin field.
 */
export function formatMoney(value) {
  const { symbol, symbolPosition } = getCurrency();
  const amount = formatPrice(value);
  return symbolPosition === "before" ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

export default { formatPrice, formatMoney };