import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireModule } from "../../../src/middlewares/feature.middleware.js";

// Deliberately NOT trying to reconfigure ENABLED_MODULES per test here (the
// way features.config.test.js does with a cache-busting import): this file's
// import of feature.middleware.js is a plain, ordinary import, and
// feature.middleware.js's own `import { FEATURES } from "../config/
// features.config.js"` is ALSO a plain import - busting only THIS file's
// import wouldn't make feature.middleware.js's own dependency re-evaluate,
// since Node resolves that inner specifier through the regular module cache
// regardless of how the outer module was loaded. Reconfiguring env vars
// across tests in one process would just silently test against whatever
// FEATURES got computed the first time anything here imported
// features.config.js - not what each individual test thinks it's setting.
//
// So this file runs under whatever ENABLED_MODULES the test suite already
// starts with (unset -> the default, all three base modules enabled - see
// features.config.js) and tests requireModule()'s own branching logic
// directly: an unknown module name is exactly as "disabled" as a real one
// that's off, since FEATURES[moduleName] is simply falsy either way - that's
// enough to exercise both branches without touching process.env at all.
// features.config.test.js is what actually verifies ENABLED_MODULES combinations
// resolve into the right FEATURES values; this file only needs one of those
// combinations to hold still while it tests the middleware built on top of it.

function fakeReq(originalUrl) {
  return { originalUrl };
}

describe("feature.middleware", () => {
  it("calls next() with no argument when the module is enabled", () => {
    const calls = [];
    requireModule("booking")(fakeReq("/api/v1/booking/slots"), {}, (...args) => calls.push(args));
    assert.deepEqual(calls, [[]]);
  });

  it("calls next(err) with a 404 AppError when the module is disabled - never a 403", () => {
    const calls = [];
    // Not a real module name, so FEATURES["definitely-not-a-real-module"] is
    // undefined - exactly as falsy as a real module that's actually turned
    // off for this deployment, without needing to change ENABLED_MODULES.
    requireModule("definitely-not-a-real-module")(fakeReq("/api/v1/whatever"), {}, (...args) => calls.push(args));

    assert.equal(calls.length, 1);
    const [err] = calls[0];
    assert.ok(err, "next() should have been called with an error");
    assert.equal(err.statusCode, 404);
    assert.equal(err.name, "NotFoundError");
    // Same wording/shape as error.middleware.js's own notFoundHandler - a
    // disabled module must be indistinguishable from a route that simply
    // doesn't exist, not a "you're not allowed here" response.
    assert.match(err.message, /nije pronađena/);
    assert.match(err.message, /\/api\/v1\/whatever/);
  });

  it("checks the exact module name given, not just truthiness of the FEATURES object", () => {
    const bookingCalls = [];
    requireModule("booking")(fakeReq("/api/v1/booking/slots"), {}, (...args) => bookingCalls.push(args));
    assert.deepEqual(bookingCalls, [[]]);

    const shopCalls = [];
    requireModule("shop")(fakeReq("/api/v1/products"), {}, (...args) => shopCalls.push(args));
    assert.deepEqual(shopCalls, [[]]);
  });
});
