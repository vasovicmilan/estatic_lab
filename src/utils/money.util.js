/**
 * Shared money-rounding utility. Several services do their own percentage-based
 * fraction math on stored prices (pro-rating a package's a la carte value by a
 * discount ratio, applying a commission rate, etc.) - each of those division/
 * multiplication chains can land on a value like 2400.0000000000005 or
 * 4210.526666..., and without a single consistent rounding step, that
 * fractional noise can drift further with every subsequent operation it feeds
 * into (a commission entry's amount summed into a payout balance, for
 * instance).
 *
 * roundMoney() is that one consistent step: round to 2 decimal places (the
 * finest unit this app's money math ever needs, even though display-facing
 * formatPrice() in price.util.js separately rounds to a whole number for
 * RSD-style display - that's a presentation choice, not a storage/computation
 * one, and is intentionally left alone here).
 *
 * Uses the Number.EPSILON nudge before rounding rather than naive
 * `Math.round(value * 100) / 100`: floating point representation error means
 * a value like 1.005 is actually stored as 1.00499999999999989..., so a naive
 * `1.005 * 100` becomes 100.49999999999999 and rounds DOWN to 100 (1.00)
 * instead of the mathematically correct 101 (1.01). Adding Number.EPSILON
 * (scaled the same way) before rounding corrects exactly this class of
 * misround without overcorrecting values that were never on a rounding
 * boundary in the first place.
 */
export function roundMoney(value) {
  const number = Number(value) || 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export default { roundMoney };
