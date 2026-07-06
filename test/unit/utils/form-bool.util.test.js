import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCheckbox } from "../../../src/utils/form-bool.util.js";

describe("form-bool.util — parseCheckbox", () => {
  it("treats '1' as true (what the admin checkbox markup actually submits when checked)", () => {
    assert.equal(parseCheckbox("1"), true);
  });

  it("treats '0' as false (the hidden fallback input for an unchecked box)", () => {
    assert.equal(parseCheckbox("0"), false);
  });

  it("still accepts 'true'/'on' for any other callers", () => {
    assert.equal(parseCheckbox("true"), true);
    assert.equal(parseCheckbox("on"), true);
  });

  it("still accepts boolean true/false directly", () => {
    assert.equal(parseCheckbox(true), true);
    assert.equal(parseCheckbox(false), false);
  });

  it("returns the fallback when the value is undefined (field not submitted)", () => {
    assert.equal(parseCheckbox(undefined, true), true);
    assert.equal(parseCheckbox(undefined, false), false);
    assert.equal(parseCheckbox(undefined), false);
  });

  it("takes the last value when express gives an array (duplicate form field)", () => {
    assert.equal(parseCheckbox(["0", "1"]), true);
    assert.equal(parseCheckbox(["1", "0"]), false);
  });

  it("treats an unrecognized string as false", () => {
    assert.equal(parseCheckbox("banana"), false);
  });
});