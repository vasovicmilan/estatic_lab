import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiAuthMiddleware, optionalApiAuth } from "../../../src/middlewares/auth.middleware.js";
import { signJwt } from "../../../src/services/crypto.service.js";
import userRepo from "../../../src/repositories/user.repository.js";

function fakeRes() {
  const res = {
    statusCode: null,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
  };
  return res;
}

// Both middlewares now do one lightweight DB lookup per request (see
// auth.middleware.js's assertTokenStillValid / user.repository.js's
// findAuthStateById) to catch a token issued before the account was
// suspended/deactivated - see user.model.js's tokenValidAfter comment for why.
// Stubbing that one repository call (rather than hitting a real DB) is enough to
// exercise every branch; findAuthStateById itself is a one-line Mongoose query
// with nothing worth unit-testing beyond what the query builders already cover
// elsewhere in this suite.
function stubAuthState(t, authState) {
  return t.mock.method(userRepo, "findAuthStateById", async () => authState);
}

describe("auth.middleware - apiAuthMiddleware", () => {
  it("sets req.user from a valid Bearer token for an active account", async (t) => {
    stubAuthState(t, { status: "active", tokenValidAfter: null });

    // Not jsonwebtoken directly - same signing secret/library access point as
    // everywhere else a token is issued or checked (auth.service.js's signJwt).
    const token = signJwt({ id: "u1", email: "a@b.com", roleName: "admin", permissions: ["access_admin_panel"] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;

    await apiAuthMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "a@b.com");
    assert.deepEqual(req.user.permissions, ["access_admin_panel"]);
  });

  it("rejects with 401 when no Authorization header is present", async (t) => {
    const req = { headers: {} };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
    assert.equal(passedError.name, "AuthenticationError");
    assert.equal(res.jsonBody, null, "the middleware must not write its own response body");
  });

  it("rejects with 401 for a malformed/invalid token", async (t) => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
    assert.equal(passedError.name, "AuthenticationError");
  });

  it("rejects a valid token for a subsequently-suspended user", async (t) => {
    // Token was issued (iat = now) before the account was suspended a moment
    // later - both the status check and the tokenValidAfter check independently
    // catch this; this exercises the plain status === 'suspended' branch.
    stubAuthState(t, { status: "suspended", tokenValidAfter: new Date() });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
    assert.equal(passedError.name, "AuthenticationError");
    assert.match(passedError.message, /suspendovan/i);
    assert.equal(req.user, undefined);
  });

  it("rejects a valid token for a deactivated (inactive) user", async (t) => {
    stubAuthState(t, { status: "inactive", tokenValidAfter: new Date() });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
    assert.equal(req.user, undefined);
  });

  it("rejects a token whose iat predates tokenValidAfter even though status looks active again (stale pre-suspension token, reactivated account)", async (t) => {
    // Simulates: token issued, then suspended (tokenValidAfter = T), then
    // reactivated (status back to "active", but tokenValidAfter is deliberately
    // left untouched - see user.model.js's comment). The OLD token must stay dead.
    const future = new Date(Date.now() + 60_000);
    stubAuthState(t, { status: "active", tokenValidAfter: future });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
  });

  it("accepts a token issued after tokenValidAfter for an active, previously-suspended-then-reactivated account", async (t) => {
    // A fresh login after reactivation has iat well after the old suspend
    // timestamp - reactivation must not have accidentally revoked it.
    const past = new Date(Date.now() - 60_000);
    stubAuthState(t, { status: "active", tokenValidAfter: past });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;

    await apiAuthMiddleware(req, res, (err) => {
      assert.equal(err, undefined);
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "a@b.com");
  });

  it("rejects with 401 when the token's user no longer exists", async (t) => {
    stubAuthState(t, null);

    const token = signJwt({ id: "gone", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let passedError = null;

    await apiAuthMiddleware(req, res, (err) => {
      passedError = err;
    });

    assert.ok(passedError, "next should be called with an error");
    assert.equal(passedError.statusCode, 401);
  });
});

describe("auth.middleware - optionalApiAuth", () => {
  it("sets req.user for a valid token for an active account but still calls next()", async (t) => {
    stubAuthState(t, { status: "active", tokenValidAfter: null });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;

    await optionalApiAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "a@b.com");
  });

  it("silently continues (no req.user, no error) when there's no token at all", async (t) => {
    const req = { headers: {} };
    const res = fakeRes();
    let nextCalled = false;

    await optionalApiAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user, undefined);
  });

  it("silently continues without req.user for a valid token belonging to a suspended account", async (t) => {
    stubAuthState(t, { status: "suspended", tokenValidAfter: new Date() });

    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;
    let nextCalledWith;

    await optionalApiAuth(req, res, (err) => {
      nextCalled = true;
      nextCalledWith = err;
    });

    assert.equal(nextCalled, true);
    assert.equal(nextCalledWith, undefined, "optional auth must never pass an error to next()");
    assert.equal(req.user, undefined);
  });
});
