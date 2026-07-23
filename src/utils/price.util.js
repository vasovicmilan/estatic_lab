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

export default { formatPrice };