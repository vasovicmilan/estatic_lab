import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNewsLetterFilter } from "../../../../src/repositories/filters/news-letter.filter.js";

describe("news-letter.filter", () => {
  it("filters by source and by interest", () => {
    const f = buildNewsLetterFilter({ source: "tocak", interest: "partnership" });
    assert.equal(f.source, "tocak");
    assert.equal(f.interests, "partnership");
  });
  it("source=unknown also matches legacy subscribers that have no source field", () => {
    assert.deepEqual(buildNewsLetterFilter({ source: "unknown" }).source, { $in: ["unknown", null] });
  });
});
