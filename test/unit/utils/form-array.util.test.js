import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toIdArray } from "../../../src/utils/form-array.util.js";

describe("form-array.util - toIdArray", () => {
  it("passes an array through, dropping any falsy entries", () => {
    assert.deepEqual(toIdArray(["a", "b", "", null, "c"]), ["a", "b", "c"]);
  });

  it("wraps a single submitted value (exactly one checkbox checked) into a one-item array", () => {
    assert.deepEqual(toIdArray("only-one"), ["only-one"]);
  });

  it("returns an empty array when nothing was submitted (every checkbox unchecked)", () => {
    assert.deepEqual(toIdArray(undefined), []);
    assert.deepEqual(toIdArray(null), []);
    assert.deepEqual(toIdArray(""), []);
  });
});
