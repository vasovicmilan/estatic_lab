import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireModule } from "../../../src/middlewares/feature.middleware.js";
import { FEATURES } from "../../../src/config/features.config.js";

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
// starts with. That must NOT be hardcoded to a specific module name like
// "booking": a white-label deployment can legitimately run this same suite
// with ENABLED_MODULES=shop,blog (booking off), and a test that assumed
// "booking" is always enabled would then fail on a perfectly correct 404 -
// exactly what happened here before this fix. Instead, pick real module
// names from whatever FEATURES this process actually loaded, so the test
// exercises requireModule()'s branching logic under ANY valid combination.
// features.config.test.js is what actually verifies ENABLED_MODULES combinations
// resolve into the right FEATURES values; this file only needs to know which
// of the base three ended up on vs. off in this run.

function fakeReq(originalUrl) {
  return { originalUrl };
}

const BASE_MODULES = ["blog", "shop", "booking"];
// features.config.js guarantees at least one base module is enabled (it
// throws at import time otherwise), so this is always found.
const enabledModule = BASE_MODULES.find((name) => FEATURES[name]);
// May be undefined under the default (all three enabled) - that's fine, the
// "unknown module name" test below already covers the disabled branch on
// its own regardless of which real modules happen to be off.
const disabledModule = BASE_MODULES.find((name) => !FEATURES[name]);

describe("feature.middleware", () => {
  it("calls next() with no argument when the module is enabled", () => {
    const calls = [];
    requireModule(enabledModule)(fakeReq(`/api/v1/${enabledModule}`), {}, (...args) => calls.push(args));
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
    const enabledCalls = [];
    requireModule(enabledModule)(fakeReq(`/api/v1/${enabledModule}`), {}, (...args) => enabledCalls.push(args));
    assert.deepEqual(enabledCalls, [[]]);

    // Only meaningful when this run actually has a real module turned off
    // (e.g. ENABLED_MODULES=shop,blog leaves "booking" disabled) - under the
    // default all-enabled state there's no real disabled module to check
    // here, and the previous test already covers the disabled branch via a
    // made-up name.
    if (disabledModule) {
      const disabledCalls = [];
      requireModule(disabledModule)(fakeReq(`/api/v1/${disabledModule}`), {}, (...args) => disabledCalls.push(args));
      assert.equal(disabledCalls.length, 1);
      assert.equal(disabledCalls[0][0].statusCode, 404);
    }
  });
});
