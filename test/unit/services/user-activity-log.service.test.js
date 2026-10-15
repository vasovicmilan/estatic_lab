import { describe, it } from "node:test";
import assert from "node:assert/strict";
import activityRepo from "../../../src/repositories/user-activity-log.repository.js";
import { recordActivity, resolveActivityUser, buildSessionKey, deleteForUser } from "../../../src/services/user-activity-log.service.js";

const USER_ID = "64b7f0f2a1b2c3d4e5f60718";
const req = (extra = {}) => ({ ip: "1.2.3.4", headers: { "user-agent": "Mozilla/5.0" }, sessionID: "sess-1", ...extra });

describe("user-activity-log.service", () => {
  it("resolveActivityUser prefers the web session user, then the API user, else null", () => {
    assert.equal(resolveActivityUser({ session: { isLoggedIn: true, user: { id: "a" } }, user: { id: "b" } }).id, "a");
    assert.equal(resolveActivityUser({ session: { isLoggedIn: false }, user: { id: "b" } }).id, "b");
    assert.equal(resolveActivityUser({}), null);
  });

  it("buildSessionKey is stable, never the raw session id, and null without a session", () => {
    const key = buildSessionKey({ sessionID: "abc" });
    assert.equal(key, buildSessionKey({ sessionID: "abc" }));
    assert.ok(!key.includes("abc"));
    assert.equal(key.length, 24);
    assert.equal(buildSessionKey({}), null);
  });

  it("records a guest entry with role guest and no user id", async (t) => {
    const create = t.mock.method(activityRepo, "createActivity", async () => ({}));
    await recordActivity({ req: req(), action: "CART_ITEM_ADDED", entity: { type: "Product", id: USER_ID }, meta: { quantity: 2 } });
    const saved = create.mock.calls[0].arguments[0];
    assert.equal(saved.userId, null);
    assert.equal(saved.role, "guest");
    assert.equal(saved.action, "CART_ITEM_ADDED");
    assert.equal(String(saved.entity.id), USER_ID);
    assert.deepEqual(saved.meta, { quantity: 2 });
    assert.equal(saved.success, true);
    assert.ok(saved.sessionKey);
  });

  it("records the logged-in user and their role", async (t) => {
    const create = t.mock.method(activityRepo, "createActivity", async () => ({}));
    await recordActivity({ req: req({ session: { isLoggedIn: true, user: { id: USER_ID, roleName: "user" } } }), action: "BOOKING_CREATED" });
    const saved = create.mock.calls[0].arguments[0];
    assert.equal(String(saved.userId), USER_ID);
    assert.equal(saved.role, "user");
  });

  it("hides personal fields in meta", async (t) => {
    const create = t.mock.method(activityRepo, "createActivity", async () => ({}));
    await recordActivity({ req: req(), action: "CONTACT_SUBMITTED", meta: { topic: "x", email: "a@b.rs", phone: "064", nested: { address: "Ulica 1" } } });
    const { meta } = create.mock.calls[0].arguments[0];
    assert.equal(meta.topic, "x");
    assert.equal(meta.email, "[sakriveno]");
    assert.equal(meta.phone, "[sakriveno]");
    assert.equal(meta.nested.address, "[sakriveno]");
  });

  it("skips bots", async (t) => {
    const create = t.mock.method(activityRepo, "createActivity", async () => ({}));
    await recordActivity({ req: req({ headers: { "user-agent": "Googlebot/2.1" } }), action: "CART_ITEM_ADDED" });
    assert.equal(create.mock.callCount(), 0);
  });

  it("never throws when the write fails", async (t) => {
    t.mock.method(activityRepo, "createActivity", async () => {
      throw new Error("db down");
    });
    await assert.doesNotReject(recordActivity({ req: req(), action: "CART_ITEM_ADDED" }));
  });

  it("deleteForUser delegates to the repository and swallows errors", async (t) => {
    const del = t.mock.method(activityRepo, "deleteByUserId", async () => {
      throw new Error("x");
    });
    await assert.doesNotReject(deleteForUser(USER_ID));
    assert.equal(del.mock.callCount(), 1);
  });
});
