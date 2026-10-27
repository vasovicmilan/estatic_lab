import { roundMoney } from "./money.util.js";

/**
 * Price resolution for a manually created order (admin "Nova porudžbina (ručno)").
 *
 * Three levels, each overriding the one before it:
 *   1. the product variant's catalog price (default - the admin leaves the field empty)
 *   2. a per-line unit price the admin typed (`priceOverride`) - e.g. a customer who took a
 *      bundle of products and paid a different price for each one
 *   3. a single final total for all the goods (`finalTotal`) - overrides 1 AND 2
 *
 * Order items are stored the same way as a normal checkout does: `price` is the UNIT price
 * and order.mapper.js shows `price * quantity` per line, while Order.subtotal is the sum of
 * the lines. So when a final total is given it can't just be written to the order and leave
 * the lines saying something else - the lines would then add up to a different number than
 * the order's total (and per-product revenue in the business report, which is computed from
 * the lines, would be wrong). Instead the final total is spread over the lines in proportion
 * to what each line would have cost at its own (level 1/2) price, so the lines always add up
 * to exactly the final total. Shipping is NOT part of this - it stays a separate amount.
 *
 * @param {Array<{ quantity: number, catalogPrice: number, priceOverride?: number|null }>} lines
 * @param {number|null} finalTotal total for all goods, or null/undefined for "automatic"
 * @returns {{ unitPrices: number[], lineTotals: number[], subtotal: number, naturalSubtotal: number, finalTotalApplied: boolean }}
 */
export function resolveManualOrderPrices(lines, finalTotal = null) {
  const natural = lines.map((line) => {
    const unit = line.priceOverride != null ? Number(line.priceOverride) : Number(line.catalogPrice) || 0;
    return { unit, total: roundMoney(unit * line.quantity) };
  });
  const naturalSubtotal = roundMoney(natural.reduce((sum, l) => sum + l.total, 0));

  if (finalTotal == null) {
    return {
      unitPrices: natural.map((l) => l.unit),
      lineTotals: natural.map((l) => l.total),
      subtotal: naturalSubtotal,
      naturalSubtotal,
      finalTotalApplied: false,
    };
  }

  const target = roundMoney(finalTotal);
  // Everything priced at 0 (e.g. a gift that is now being charged for after all) has no
  // proportions to follow - fall back to splitting by quantity instead.
  const weights = naturalSubtotal > 0 ? natural.map((l) => l.total) : lines.map((l) => l.quantity);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  // Work in whole cents so nothing is lost to float rounding: every line but the last gets
  // its rounded-down share, the last line takes whatever is left, so the lines add up to the
  // final total to the cent.
  const targetCents = Math.round(target * 100);
  const lineCents = [];
  let allocated = 0;
  lines.forEach((_, i) => {
    const isLast = i === lines.length - 1;
    const cents = isLast ? targetCents - allocated : Math.floor((targetCents * weights[i]) / weightSum);
    lineCents.push(cents);
    allocated += cents;
  });

  const lineTotals = lineCents.map((c) => c / 100);
  return {
    unitPrices: lineTotals.map((total, i) => total / lines[i].quantity),
    lineTotals,
    subtotal: target,
    naturalSubtotal,
    finalTotalApplied: true,
  };
}

export default { resolveManualOrderPrices };
