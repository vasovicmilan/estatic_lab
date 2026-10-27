import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeManualOrderBody } from "../../../src/controllers/api/v1/admin-order.controller.js";

const run = (body) => {
  const req = { body };
  let called = false;
  normalizeManualOrderBody(req, {}, () => (called = true));
  assert.ok(called);
  return req.body;
};

describe("normalizeManualOrderBody (API)", () => {
  it("wraps the legacy single-product shape into items[]", () => {
    const body = run({ productId: "p", variantId: "v", quantity: 2, priceOverride: 500 });
    assert.deepEqual(body.items, [{ productId: "p", variantId: "v", quantity: 2, price: 500 }]);
  });

  it("leaves the multi-product shape untouched", () => {
    const items = [{ productId: "p", variantId: "v", quantity: 1 }];
    assert.equal(run({ items, finalTotal: 100 }).items, items);
  });
});
