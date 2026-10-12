import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTtlCache } from "../../../src/utils/ttl-cache.util.js";

describe("createTtlCache", () => {
  it("stores and returns values", () => {
    const c = createTtlCache(1000);
    c.set("a", 1);
    assert.equal(c.get("a"), 1);
  });
  it("is bounded: evicts the oldest entry beyond maxEntries", () => {
    const c = createTtlCache(1000, 3);
    for (const k of ["a", "b", "c", "d"]) c.set(k, k);
    assert.equal(c.size(), 3);
    assert.equal(c.get("a"), undefined);
    assert.equal(c.get("d"), "d");
  });
  it("overwriting a key does not evict others", () => {
    const c = createTtlCache(1000, 2);
    c.set("a", 1); c.set("b", 2); c.set("a", 3);
    assert.equal(c.get("b"), 2);
    assert.equal(c.get("a"), 3);
  });
});
