// Optional EUR price shown NEXT TO the main (RSD) price - presentation only.
//
// Nothing in carts, orders, bookings, commissions or reports ever reads these values: the shop and
// the booking flow keep charging in the one implicit currency (see price.util.js). An item that
// has no EUR price entered simply shows no EUR price. Because the admin types the amount
// (instead of it being converted from a rate), it can be a "nice" price (49 EUR, not 48.67).

/** "" / null / undefined / garbage -> null, otherwise the number. */
export function normalizeEur(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** 21 -> "21 €", 12.5 -> "12,50 €", nothing -> null. No thousands separator, same as the RSD prices. */
export function formatEur(value) {
  const number = normalizeEur(value);
  if (number === null || number <= 0) return null;
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(".", ",");
  return `${text} €`;
}

/**
 * "20 € - 30 €" / "20 €" for a set of active items, but ONLY when every one of them has an EUR price -
 * a range built from a few of three variations would understate what the item costs.
 */
export function formatEurRange(values = []) {
  const numbers = values.map(normalizeEur);
  if (!numbers.length || numbers.some((n) => n === null || n <= 0)) return null;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? formatEur(min) : `${formatEur(min).replace(" €", "")} - ${formatEur(max)}`;
}

/**
 * Admin-side check for one row (a product variation, a service variant, a package):
 * returns an error message or null. `price` is the EUR price, `oldPrice` the struck-through one.
 */
export function validateEurPair({ price, oldPrice }, label = "Stavka") {
  const eur = normalizeEur(price);
  const old = normalizeEur(oldPrice);
  if (price !== undefined && price !== null && price !== "" && eur === null) return `${label}: cena u evrima mora biti broj`;
  if (oldPrice !== undefined && oldPrice !== null && oldPrice !== "" && old === null) return `${label}: stara cena u evrima mora biti broj`;
  if (eur !== null && eur < 0) return `${label}: cena u evrima ne može biti negativna`;
  if (old !== null && old < 0) return `${label}: stara cena u evrima ne može biti negativna`;
  if (old !== null && old > 0 && (eur === null || eur === 0)) return `${label}: stara cena u evrima traži i cenu u evrima`;
  return null;
}

export default { normalizeEur, formatEur, formatEurRange, validateEurPair };
