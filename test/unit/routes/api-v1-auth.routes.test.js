import { describe, it } from "node:test";
import assert from "node:assert/strict";
import authRoutes from "../../../src/routes/api/v1/auth.routes.js";
import { apiAuthLimiter } from "../../../src/middlewares/rate-limiter.middleware.js";

// These don't spin up the full app (no DB, no session store) - they just walk the
// Router's own internal stack and check, by reference equality, that apiAuthLimiter
// (the same limiter instance the web auth routes' equivalents get - see
// rate-limiter.middleware.js) is actually wired onto each API v1 auth route.
// A prior audit found /register, /forgot-password, /reset-password and /verify were
// missing it while /login already had it; this asserts all five now carry it.
function middlewareHandlersFor(method, path) {
  const layer = authRoutes.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  return layer ? layer.route.stack.map((s) => s.handle) : null;
}

describe("api/v1 auth routes - rate limiting", () => {
  const protectedRoutes = [
    ["post", "/register"],
    ["post", "/login"],
    ["post", "/forgot-password"],
    ["put", "/reset-password/:token"],
    ["get", "/verify/:token"],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`applies apiAuthLimiter to ${method.toUpperCase()} ${path}`, () => {
      const handlers = middlewareHandlersFor(method, path);
      assert.ok(handlers, `route ${method.toUpperCase()} ${path} not found`);
      assert.ok(handlers.includes(apiAuthLimiter), `apiAuthLimiter is not wired on ${method.toUpperCase()} ${path}`);
    });
  }
});
