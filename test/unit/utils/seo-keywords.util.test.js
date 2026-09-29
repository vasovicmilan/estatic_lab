import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSeoKeywords } from "../../../src/utils/seo-keywords.util.js";

describe("parseSeoKeywords", () => {
  it("reads the generic admin form's seoKeywordsCsv field (comma separated)", () => {
    assert.deepEqual(parseSeoKeywords({ seoKeywordsCsv: "masaža, relax ,  spa" }), ["masaža", "relax", "spa"]);
  });

  it("still accepts the legacy seoKeywords field, as a string or an array", () => {
    assert.deepEqual(parseSeoKeywords({ seoKeywords: "a, b" }), ["a", "b"]);
    assert.deepEqual(parseSeoKeywords({ seoKeywords: ["a", "b,c", ""] }), ["a", "b", "c"]);
  });

  it("prefers seoKeywordsCsv when both are present", () => {
    assert.deepEqual(parseSeoKeywords({ seoKeywordsCsv: "nova", seoKeywords: "stara" }), ["nova"]);
  });

  it("drops empty and duplicate (case-insensitive) entries but keeps first-seen order and casing", () => {
    assert.deepEqual(parseSeoKeywords({ seoKeywordsCsv: "Spa, spa,, wellness ,SPA" }), ["Spa", "wellness"]);
  });

  it("returns an empty array for an empty or missing field - an explicit clear", () => {
    assert.deepEqual(parseSeoKeywords({ seoKeywordsCsv: "" }), []);
    assert.deepEqual(parseSeoKeywords({}), []);
    assert.deepEqual(parseSeoKeywords(undefined), []);
  });
});
