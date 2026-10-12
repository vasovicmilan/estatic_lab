import { describe, it } from "node:test";
import assert from "node:assert/strict";
import userRepo from "../../../src/repositories/user.repository.js";
import { sessionRevalidation, SESSION_RECHECK_MS } from "../../../src/middlewares/auth.middleware.js";

function run(session, t, authState, { fail = false } = {}) {
  const spy = t.mock.method(userRepo, "findAuthStateById", async () => {
    if (fail) throw new Error("db down");
    return authState;
  });
  const req = { session };
  let nextCalled = false;
  return sessionRevalidation(req, {}, () => (nextCalled = true)).then(() => ({ req, spy, nextCalled }));
}

const freshSession = (over = {}) => ({ isLoggedIn: true, user: { id: "u1" }, loginAt: Date.now() - 10_000, authCheckedAt: 0, ...over });

describe("sessionRevalidation", () => {
  it("ignores anonymous requests without touching the DB", async (t) => {
    const { spy, nextCalled } = await run({}, t, null);
    assert.equal(spy.mock.callCount(), 0);
    assert.ok(nextCalled);
  });

  it("keeps an active account logged in and records the check time", async (t) => {
    const { req } = await run(freshSession(), t, { status: "active" });
    assert.equal(req.session.isLoggedIn, true);
    assert.ok(req.session.authCheckedAt > 0);
  });

  it("does not re-query inside the recheck window", async (t) => {
    const { spy } = await run(freshSession({ authCheckedAt: Date.now() - SESSION_RECHECK_MS / 2 }), t, { status: "suspended" });
    assert.equal(spy.mock.callCount(), 0);
  });

  it("logs out a suspended account", async (t) => {
    const { req } = await run(freshSession(), t, { status: "suspended" });
    assert.equal(req.session.isLoggedIn, false);
    assert.equal(req.session.user, undefined);
  });

  it("logs out a deleted account", async (t) => {
    const { req } = await run(freshSession(), t, null);
    assert.equal(req.session.isLoggedIn, false);
  });

  it("logs out a session older than tokenValidAfter (role change / password reset)", async (t) => {
    const { req } = await run(freshSession(), t, { status: "active", tokenValidAfter: new Date() });
    assert.equal(req.session.isLoggedIn, false);
  });

  it("keeps a session that started after tokenValidAfter", async (t) => {
    const { req } = await run(freshSession(), t, { status: "active", tokenValidAfter: new Date(Date.now() - 60_000) });
    assert.equal(req.session.isLoggedIn, true);
  });

  it("fails open when the lookup throws", async (t) => {
    const { req, nextCalled } = await run(freshSession(), t, null, { fail: true });
    assert.equal(req.session.isLoggedIn, true);
    assert.ok(nextCalled);
  });
});
