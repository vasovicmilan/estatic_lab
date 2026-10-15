import { describe, it } from "node:test";
import assert from "node:assert/strict";
import UserActivityLog, { USER_ACTIVITY_RETENTION_SECONDS } from "../../../src/models/user-activity-log.model.js";

describe("user-activity-log.model", () => {
  it("declares a TTL index on `timestamp` for 12-month (365 day) retention", () => {
    const ttl = UserActivityLog.schema.indexes().find(([, options]) => options && typeof options.expireAfterSeconds === "number");
    assert.ok(ttl);
    assert.deepEqual(ttl[0], { timestamp: 1 });
    assert.equal(ttl[1].expireAfterSeconds, 365 * 24 * 60 * 60);
    assert.equal(USER_ACTIVITY_RETENTION_SECONDS, 365 * 24 * 60 * 60);
  });

  it("keeps the per-user and per-entity lookup indexes", () => {
    const indexes = UserActivityLog.schema.indexes();
    assert.ok(indexes.some(([f]) => f.userId === 1 && f.timestamp === -1));
    assert.ok(indexes.some(([f]) => f["entity.type"] === 1 && f["entity.id"] === 1 && f.timestamp === -1));
  });

  it("accepts a guest entry (no userId) and a non-ObjectId entity id", () => {
    const doc = new UserActivityLog({ action: "CART_ITEM_ADDED", entity: { type: "Product", id: "singleton" } });
    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.userId, null);
    assert.equal(doc.role, "guest");
  });

  it("requires an action", () => {
    assert.ok(new UserActivityLog({}).validateSync().errors.action);
  });
});
