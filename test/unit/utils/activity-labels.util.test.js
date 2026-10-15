import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getUserActionLabel, isUserVisibleAction, getAdminActionLabel } from "../../../src/utils/activity-labels.util.js";

describe("activity-labels.util", () => {
  it("labels known actions in Serbian and hides unknown/admin ones from customers", () => {
    assert.equal(getUserActionLabel("CART_ITEM_ADDED"), "Proizvod dodat u korpu");
    assert.equal(isUserVisibleAction("PRODUCT_UPDATED"), false);
    assert.equal(getUserActionLabel("PRODUCT_UPDATED"), null);
    assert.equal(isUserVisibleAction("toString"), false);
  });

  it("admin label falls back to the raw action name", () => {
    assert.equal(getAdminActionLabel("PRODUCT_UPDATED"), "PRODUCT_UPDATED");
  });
});
