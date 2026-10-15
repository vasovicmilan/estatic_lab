import { describe, it } from "node:test";
import assert from "node:assert/strict";
import auditLogService from "../../../src/services/audit-log.service.js";
import { createEntityActionFactory } from "../../../src/utils/admin-entity-action.util.js";

function buildReqRes() {
  const req = { params: { orderId: "6ad11f919b5a514f904f6c18" }, user: { id: "u1", email: "a@b.c", roleName: "admin" }, ip: "1.1.1.1", headers: {} };
  const res = { body: null, json(payload) { this.body = payload; return this; } };
  return { req, res };
}

describe("createEntityActionFactory", () => {
  const entityAction = createEntityActionFactory({ logPrefix: "test", entityType: "Order", entityLabel: "Porudžbina", idParam: "orderId" });

  it("records a successful audit entry after the service call succeeds", async (t) => {
    const recorded = [];
    t.mock.method(auditLogService, "recordAuditLog", async (entry) => recorded.push(entry));
    const { req, res } = buildReqRes();

    await entityAction("confirm", "ORDER_CONFIRMED", async () => {}, "ok")(req, res, () => {});

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].action, "ORDER_CONFIRMED");
    assert.equal(recorded[0].success, true);
    assert.deepEqual(recorded[0].entity, { type: "Order", id: "6ad11f919b5a514f904f6c18" });
  });

  it("records a failed entry (success:false + message) when the service call throws, then passes the error on", async (t) => {
    const recorded = [];
    t.mock.method(auditLogService, "recordAuditLog", async (entry) => recorded.push(entry));
    const { req, res } = buildReqRes();
    const failure = new Error("Porudžbina je već otkazana");
    let forwarded;

    await entityAction("cancel", "ORDER_CANCELLED", async () => { throw failure; }, "ok")(req, res, (err) => { forwarded = err; });

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].action, "ORDER_CANCELLED");
    assert.equal(recorded[0].success, false);
    assert.equal(recorded[0].errorMessage, "Porudžbina je već otkazana");
    assert.equal(forwarded, failure);
  });
});
