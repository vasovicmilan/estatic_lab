import { describe, it } from "node:test";
import assert from "node:assert/strict";

// features.config.js computes FEATURES once, synchronously, at import time
// from process.env.ENABLED_MODULES - it isn't a function you call per
// scenario. Node's ES module cache would hand back the SAME already-computed
// FEATURES object on a second plain import within this file's process, no
// matter how ENABLED_MODULES changes in between. A cache-busting query string
// forces a genuinely fresh module evaluation per scenario instead - the same
// technique test/integration/setup/test-app.js uses for src/app.js, and for
// the same reason: this file is the one thing in the whole test suite that
// actually needs to see the module recompute FEATURES from a different env
// value, more than once, in the same process.
async function loadFeatures(enabledModules) {
  if (enabledModules === undefined) {
    delete process.env.ENABLED_MODULES;
  } else {
    process.env.ENABLED_MODULES = enabledModules;
  }
  const mod = await import(`../../../src/config/features.config.js?scenario=${Date.now()}-${Math.random()}`);
  return mod.FEATURES;
}

describe("features.config", () => {
  it("defaults to all three base modules enabled when ENABLED_MODULES is unset", async () => {
    const FEATURES = await loadFeatures(undefined);
    assert.equal(FEATURES.blog, true);
    assert.equal(FEATURES.shop, true);
    assert.equal(FEATURES.booking, true);
    assert.equal(FEATURES.coupons, true);
    assert.equal(FEATURES.partners, true);
    assert.equal(FEATURES.employees, true);
  });

  it("enables only the listed module(s) and derives the rest correctly - booking only", async () => {
    const FEATURES = await loadFeatures("booking");
    assert.equal(FEATURES.blog, false);
    assert.equal(FEATURES.shop, false);
    assert.equal(FEATURES.booking, true);
    // coupons/partners: "shop || booking" - booking alone is enough
    assert.equal(FEATURES.coupons, true);
    assert.equal(FEATURES.partners, true);
    // employees is tied to booking specifically
    assert.equal(FEATURES.employees, true);
  });

  it("enables only the listed module(s) and derives the rest correctly - shop only", async () => {
    const FEATURES = await loadFeatures("shop");
    assert.equal(FEATURES.blog, false);
    assert.equal(FEATURES.shop, true);
    assert.equal(FEATURES.booking, false);
    assert.equal(FEATURES.coupons, true);
    assert.equal(FEATURES.partners, true);
    // employees needs booking specifically - shop alone doesn't imply staff
    assert.equal(FEATURES.employees, false);
  });

  it("a blog-only deployment has no coupons, no partners, no employees", async () => {
    const FEATURES = await loadFeatures("blog");
    assert.equal(FEATURES.blog, true);
    assert.equal(FEATURES.shop, false);
    assert.equal(FEATURES.booking, false);
    assert.equal(FEATURES.coupons, false);
    assert.equal(FEATURES.partners, false);
    assert.equal(FEATURES.employees, false);
  });

  it("accepts a comma-separated combination with incidental whitespace", async () => {
    const FEATURES = await loadFeatures("blog, shop");
    assert.equal(FEATURES.blog, true);
    assert.equal(FEATURES.shop, true);
    assert.equal(FEATURES.booking, false);
  });

  it("throws for an unknown module name instead of silently ignoring it", async () => {
    await assert.rejects(() => loadFeatures("booking,webinars"), /unknown module/i);
  });

  it("throws when ENABLED_MODULES resolves to no modules at all", async () => {
    // A single space, not "" - an empty string is falsy, so
    // `process.env.ENABLED_MODULES || BASE_MODULES.join(",")` would silently
    // fall back to the full default list before ever reaching the
    // "at least one module" check. A whitespace-only value is truthy (skips
    // that fallback) but trims/filters down to zero real entries, which is
    // the actual empty-list path this test means to exercise.
    await assert.rejects(() => loadFeatures(" "), /at least one module/i);
  });
});
