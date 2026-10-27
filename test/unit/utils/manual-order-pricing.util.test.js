import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveManualOrderPrices } from "../../../src/utils/manual-order-pricing.util.js";

const sum = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) * 100) / 100;

describe("resolveManualOrderPrices", () => {
  it("uses the catalog price when no price was typed (the default)", () => {
    const r = resolveManualOrderPrices([{ quantity: 2, catalogPrice: 1000 }, { quantity: 1, catalogPrice: 500 }]);

    assert.deepEqual(r.unitPrices, [1000, 500]);
    assert.equal(r.subtotal, 2500);
    assert.equal(r.finalTotalApplied, false);
  });

  it("a typed per-line price replaces the catalog price for that line only", () => {
    const r = resolveManualOrderPrices([
      { quantity: 2, catalogPrice: 1000, priceOverride: 800 },
      { quantity: 1, catalogPrice: 500, priceOverride: null },
    ]);

    assert.deepEqual(r.unitPrices, [800, 500]);
    assert.equal(r.subtotal, 2100);
  });

  it("a typed price of 0 is a real price (a free item), not 'unset'", () => {
    const r = resolveManualOrderPrices([{ quantity: 1, catalogPrice: 1000, priceOverride: 0 }]);
    assert.equal(r.subtotal, 0);
  });

  it("a final total overrides BOTH catalog and typed prices, and the lines add up to exactly it", () => {
    const lines = [
      { quantity: 2, catalogPrice: 1000, priceOverride: 800 }, // 1600
      { quantity: 1, catalogPrice: 400 }, // 400
    ];
    const r = resolveManualOrderPrices(lines, 1500);

    assert.equal(r.finalTotalApplied, true);
    assert.equal(r.subtotal, 1500);
    assert.equal(r.naturalSubtotal, 2000);
    assert.equal(sum(r.lineTotals), 1500);
    // proportional: 80% / 20% of 1500
    assert.deepEqual(r.lineTotals, [1200, 300]);
    assert.equal(r.unitPrices[0] * lines[0].quantity, 1200);
  });

  it("REGRESSION-style: the stored lines always sum to the final total to the cent, even when it doesn't divide evenly", () => {
    const lines = [
      { quantity: 3, catalogPrice: 333 },
      { quantity: 1, catalogPrice: 777 },
      { quantity: 7, catalogPrice: 19.99 },
    ];
    const r = resolveManualOrderPrices(lines, 1999.99);

    assert.equal(sum(r.lineTotals), 1999.99);
    assert.equal(r.subtotal, 1999.99);
    r.lineTotals.forEach((t) => assert.ok(t >= 0));
  });

  it("can raise the price above the catalog total as well as lower it", () => {
    const r = resolveManualOrderPrices([{ quantity: 1, catalogPrice: 1000 }], 1500);
    assert.equal(r.subtotal, 1500);
    assert.deepEqual(r.unitPrices, [1500]);
  });

  it("a final total of 0 makes everything free (a gift)", () => {
    const r = resolveManualOrderPrices([{ quantity: 2, catalogPrice: 1000 }, { quantity: 1, catalogPrice: 500 }], 0);
    assert.equal(r.subtotal, 0);
    assert.deepEqual(r.unitPrices, [0, 0]);
  });

  it("splits by quantity when every line is priced at 0 (no proportions to follow)", () => {
    const r = resolveManualOrderPrices([{ quantity: 1, catalogPrice: 0 }, { quantity: 3, catalogPrice: 0 }], 400);
    assert.deepEqual(r.lineTotals, [100, 300]);
  });

  it("a single line just takes the whole final total", () => {
    const r = resolveManualOrderPrices([{ quantity: 4, catalogPrice: 250 }], 900);
    assert.equal(r.lineTotals[0], 900);
    assert.equal(r.unitPrices[0], 225);
  });
});
