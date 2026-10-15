import { describe, it } from "node:test";
import assert from "node:assert/strict";
import activityRepo from "../../../src/repositories/user-activity-log.repository.js";
import auditRepo from "../../../src/repositories/audit-log.repository.js";
import { getAdminUserHistory, getOwnHistory } from "../../../src/services/user-history.service.js";

const USER_ID = "64b7f0f2a1b2c3d4e5f60718";
const ORDER_ID = "64b7f0f2a1b2c3d4e5f60719";
const related = { User: [USER_ID], Order: [ORDER_ID], TemporaryOrder: [], Appointment: [], PackagePurchase: [], Employee: [], Partner: [], PayoutRequest: [] };

function mockRepos(t, { audit = [], activity = [] } = {}) {
  t.mock.method(activityRepo, "findRelatedEntityIds", async () => related);
  const auditFind = t.mock.method(auditRepo, "findByQuery", async () => audit);
  const activityFind = t.mock.method(activityRepo, "findByQuery", async () => activity);
  t.mock.method(auditRepo, "countByQuery", async () => audit.length);
  t.mock.method(activityRepo, "countByQuery", async () => activity.length);
  return { auditFind, activityFind };
}

const auditRow = (id, minutes, action) => ({ _id: id, timestamp: new Date(2026, 0, 1, 10, minutes), action, actor: { id: USER_ID, email: "x@y.rs", role: "user" }, changes: { telefon: { old: "[sakriveno]", new: "[sakriveno]" } }, success: true });
const activityRow = (id, minutes, action) => ({ _id: id, timestamp: new Date(2026, 0, 1, 10, minutes), action, userId: USER_ID, role: "user", success: true, meta: { quantity: 1 } });

describe("user-history.service", () => {
  it("merges audit and activity entries newest first", async (t) => {
    mockRepos(t, { audit: [auditRow("a1", 5, "LOGIN_SUCCEEDED")], activity: [activityRow("c1", 9, "CART_ITEM_ADDED"), activityRow("c2", 1, "CART_ITEM_REMOVED")] });
    const result = await getAdminUserHistory(USER_ID, { page: 1, limit: 10 });
    assert.deepEqual(result.data.map((r) => r.action), ["CART_ITEM_ADDED", "LOGIN_SUCCEEDED", "CART_ITEM_REMOVED"]);
    assert.equal(result.total, 3);
  });

  it("includes entries about the user's related records in the admin queries", async (t) => {
    const { auditFind, activityFind } = mockRepos(t);
    await getAdminUserHistory(USER_ID);
    const auditQuery = auditFind.mock.calls[0].arguments[0];
    assert.ok(auditQuery.$or.some((c) => c["entity.type"] === "Order"));
    assert.ok(auditQuery.$or.some((c) => c["entity.type"] === "User"));
    assert.ok(activityFind.mock.calls[0].arguments[0].$or.some((c) => c["entity.type"] === "Order"));
  });

  it("pages the merged list", async (t) => {
    mockRepos(t, { activity: [activityRow("c1", 9, "CART_ITEM_ADDED"), activityRow("c2", 8, "CART_ITEM_UPDATED"), activityRow("c3", 7, "CART_ITEM_REMOVED")] });
    const page2 = await getAdminUserHistory(USER_ID, { page: 2, limit: 2 });
    assert.deepEqual(page2.data.map((r) => r.action), ["CART_ITEM_REMOVED"]);
  });

  it("customer view only asks for their own audit entries and allow-listed actions", async (t) => {
    const { auditFind } = mockRepos(t, { audit: [auditRow("a1", 5, "LOGIN_SUCCEEDED"), auditRow("a2", 4, "SOME_INTERNAL_ACTION")] });
    const result = await getOwnHistory(USER_ID);
    const query = auditFind.mock.calls[0].arguments[0];
    assert.equal(String(query["actor.id"]), USER_ID);
    assert.ok(Array.isArray(query.action.$in) && query.action.$in.includes("LOGIN_SUCCEEDED"));
    assert.deepEqual(result.data.map((r) => r.action), ["LOGIN_SUCCEEDED"]);
  });
});
