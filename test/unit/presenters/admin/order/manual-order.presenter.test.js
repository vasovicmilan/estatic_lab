import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareManualOrderFormData } from "../../../../../src/presenters/admin/order/manual-order.presenter.js";
import { prepareOrderListData } from "../../../../../src/presenters/admin/order/order.presenter.js";

describe("prepareManualOrderFormData", () => {
  it("passes products and userOptions through unchanged", () => {
    const products = [{ id: "p1", name: "X", priceOnRequest: false, variants: [] }];
    const userOptions = [{ value: "u1", label: "Marko" }];
    const view = prepareManualOrderFormData({ products, userOptions });
    assert.deepEqual(view.products, products);
    assert.deepEqual(view.userOptions, userOptions);
  });

  it("defaults to empty arrays when nothing is passed", () => {
    const view = prepareManualOrderFormData();
    assert.deepEqual(view.products, []);
    assert.deepEqual(view.userOptions, []);
  });

  it("points the form at the manual-order creation endpoint", () => {
    const view = prepareManualOrderFormData();
    assert.equal(view.formAction, "/admin/porudzbine/rucno-kreiranje");
  });
});

describe("prepareOrderListData - manual create button", () => {
  it("exposes a createUrl/createLabel pointing at the manual order form", () => {
    const view = prepareOrderListData({ data: [], page: 1, totalPages: 1 }, {});
    assert.equal(view.topbar.createUrl, "/admin/porudzbine/rucno-kreiranje");
    assert.ok(view.topbar.createLabel);
  });
});
