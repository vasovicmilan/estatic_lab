import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseManualOrderItems } from "../../../src/controllers/web/admin/order/manual-order.controller.js";

describe("parseManualOrderItems", () => {
  it("turns form rows into items, an empty price meaning 'use the catalog price' (null)", () => {
    const items = parseManualOrderItems([
      { productId: "p1", variantId: "v1", quantity: "2", price: "" },
      { productId: "p2", variantId: "v2", quantity: "1", price: "1500.50" },
      { productId: "p3", variantId: "v3", quantity: "1", price: "0" },
    ]);

    assert.deepEqual(items, [
      { productId: "p1", variantId: "v1", quantity: 2, priceOverride: null },
      { productId: "p2", variantId: "v2", quantity: 1, priceOverride: 1500.5 },
      { productId: "p3", variantId: "v3", quantity: 1, priceOverride: 0 },
    ]);
  });

  it("accepts the object-keyed shape qs produces for sparse indices, and keeps row order", () => {
    const items = parseManualOrderItems({ 0: { productId: "a", variantId: "x", quantity: "1" }, 4: { productId: "b", variantId: "y", quantity: "3" } });
    assert.deepEqual(items.map((i) => i.productId), ["a", "b"]);
  });

  it("returns an empty list for a missing field", () => {
    assert.deepEqual(parseManualOrderItems(undefined), []);
  });
});
