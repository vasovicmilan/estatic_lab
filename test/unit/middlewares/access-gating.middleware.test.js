import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adminMiddleware } from "../../../src/middlewares/admin.middleware.js";
import { requirePermission } from "../../../src/middlewares/permission.middleware.js";
import { employeeMiddleware } from "../../../src/middlewares/employee.middleware.js";
import { partnerMiddleware } from "../../../src/middlewares/partner.middleware.js";

function fakeWebReq(overrides = {}) {
  const flashCalls = [];
  return {
    originalUrl: "/admin/termini",
    headers: {},
    xhr: false,
    flash: (type, msg) => flashCalls.push([type, msg]),
    _flashCalls: flashCalls,
    ...overrides,
  };
}

function fakeApiReq(overrides = {}) {
  return fakeWebReq({ originalUrl: "/api/v1/admin/termini", ...overrides });
}

function fakeRes() {
  const res = {
    redirected: null,
    statusCode: null,
    jsonBody: null,
    redirect(url) {
      this.redirected = url;
      return this;
    },
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

// Every gating middleware shares the same req.user-based shape (set upstream by
// webAuthMiddleware for a session, apiAuthMiddleware for a Bearer token), so they're
// tested with the same matrix rather than four near-identical describe blocks.
const cases = [
  {
    name: "adminMiddleware",
    middleware: adminMiddleware,
    passingUser: { permissions: ["access_admin_panel"] },
    failingUser: { permissions: ["manage_orders"] },
  },
  {
    name: "requirePermission('manage_orders')",
    middleware: requirePermission("manage_orders"),
    passingUser: { permissions: ["manage_orders"] },
    failingUser: { permissions: ["access_admin_panel"] },
  },
  {
    name: "employeeMiddleware",
    middleware: employeeMiddleware,
    passingUser: { isEmployee: true },
    failingUser: { isEmployee: false },
  },
  {
    name: "partnerMiddleware",
    middleware: partnerMiddleware,
    passingUser: { isPartner: true },
    failingUser: { isPartner: false },
  },
];

for (const { name, middleware, passingUser, failingUser } of cases) {
  describe(name, () => {
    it("redirects to /prijava for an unauthenticated WEB request (no req.user)", () => {
      const req = fakeWebReq();
      const res = fakeRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.ok(res.redirected?.startsWith("/prijava"));
      assert.equal(req._flashCalls.length, 1);
      assert.equal(nextCalled, false);
    });

    it("passes a 401 AuthenticationError to next() (not a redirect, no inline body) for an unauthenticated API request (no req.user)", () => {
      // Bearer-token requests have no session to flash a message into or redirect a
      // JSON client to an HTML login page - this is exactly the gap that meant a
      // valid, verified token could never actually pass these gates before.
      const req = fakeApiReq();
      const res = fakeRes();
      let passedError = null;

      middleware(req, res, (err) => {
        passedError = err;
      });

      // globalErrorHandler renders the standard { success:false, error:{ id, ... } }
      // JSON for this - the middleware itself must not answer with its own body.
      assert.equal(res.redirected, null);
      assert.equal(res.statusCode, null);
      assert.equal(res.jsonBody, null);
      assert.ok(passedError, "next should be called with an error");
      assert.equal(passedError.statusCode, 401);
      assert.equal(passedError.name, "AuthenticationError");
    });

    it("calls next(AppError 403) when req.user exists but lacks the required permission/flag", () => {
      const req = fakeWebReq({ user: failingUser });
      const res = fakeRes();
      let passedError = null;

      middleware(req, res, (err) => {
        passedError = err;
      });

      assert.ok(passedError, "next should be called with an error");
      assert.equal(passedError.statusCode, 403);
    });

    it("calls next() with no error when req.user has the required permission/flag - session-based", () => {
      const req = fakeWebReq({ user: passingUser });
      const res = fakeRes();
      let nextCalledWith = "not-called";

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      assert.equal(nextCalledWith, undefined);
    });

    it("calls next() with no error when req.user has the required permission/flag - token-based (API request)", () => {
      // The exact scenario that was broken: a verified Bearer token sets req.user,
      // but on an /api path with no session at all - these middlewares must gate on
      // req.user regardless of which auth method populated it.
      const req = fakeApiReq({ user: passingUser });
      const res = fakeRes();
      let nextCalledWith = "not-called";

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      assert.equal(nextCalledWith, undefined);
    });
  });
}
