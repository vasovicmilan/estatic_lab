import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiAuthMiddleware, optionalApiAuth } from "../../../src/middlewares/auth.middleware.js";
import { signJwt } from "../../../src/services/crypto.service.js";

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

describe("auth.middleware - apiAuthMiddleware", () => {
  it("sets req.user from a valid Bearer token, verified via crypto.service.js's verifyJwt", () => {
    // Not jsonwebtoken directly - same signing secret/library access point as
    // everywhere else a token is issued or checked (auth.service.js's signJwt).
    const token = signJwt({ id: "u1", email: "a@b.com", roleName: "admin", permissions: ["access_admin_panel"] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;

    apiAuthMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "a@b.com");
    assert.deepEqual(req.user.permissions, ["access_admin_panel"]);
  });

  it("rejects with 401 when no Authorization header is present", () => {
    const req = { headers: {} };
    const res = fakeRes();
    let nextCalled = false;

    apiAuthMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it("rejects with 401 for a malformed/invalid token", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } };
    const res = fakeRes();
    let nextCalled = false;

    apiAuthMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });
});

describe("auth.middleware - optionalApiAuth", () => {
  it("sets req.user for a valid token but still calls next()", () => {
    const token = signJwt({ id: "u1", email: "a@b.com" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;

    optionalApiAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "a@b.com");
  });

  it("silently continues (no req.user, no error) when there's no token at all", () => {
    const req = { headers: {} };
    const res = fakeRes();
    let nextCalled = false;

    optionalApiAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user, undefined);
  });
});
