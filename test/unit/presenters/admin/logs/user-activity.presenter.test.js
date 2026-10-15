import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareActivityListData, prepareUserHistoryData } from "../../../../../src/presenters/admin/logs/user-activity.presenter.js";

describe("admin user activity presenter", () => {
  it("shows a guest row and meta details", () => {
    const data = prepareActivityListData({ data: [{ _id: "1", timestamp: new Date(), action: "CART_ITEM_ADDED", role: "guest", entity: { type: "Product", id: "p1" }, meta: { quantity: 2, variantId: null }, success: true }], page: 1, totalPages: 1, total: 1, limit: 25 }, {}, ["CART_ITEM_ADDED"]);
    const row = data.items[0];
    assert.equal(row.korisnikId, null);
    assert.equal(row.entitet, "Proizvod #p1");
    assert.equal(row.detalji, "quantity: 2");
    assert.ok(data.filters.role.options.some((o) => o.value === "guest"));
  });

  it("marks audit vs activity source in the merged user history", () => {
    const data = prepareUserHistoryData(
      { imePrezime: "A B", email: "a@b.rs" },
      { data: [{ id: "1", source: "audit", timestamp: new Date(), action: "LOGIN_SUCCEEDED", actor: { email: "a@b.rs", role: "user" }, success: true }, { id: "2", source: "activity", timestamp: new Date(), action: "CART_ITEM_ADDED", actor: { id: "u" }, success: true }], page: 1, totalPages: 1, total: 2, limit: 25 },
      "u1"
    );
    assert.deepEqual(data.items.map((i) => i.izvor), ["Audit", "Aktivnost"]);
    assert.equal(data.backUrl, "/admin/korisnici/detalji/u1");
  });
});
