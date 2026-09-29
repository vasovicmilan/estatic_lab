import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_PAGE_SIZES, resolvePublicLimit } from "../../../src/utils/pagination.util.js";

describe("resolvePublicLimit", () => {
  it("accepts every offered page size (string or number)", () => {
    for (const size of PUBLIC_PAGE_SIZES) {
      assert.equal(resolvePublicLimit(String(size), 12), size);
      assert.equal(resolvePublicLimit(size, 12), size);
    }
  });

  it("falls back to the page default for anything else", () => {
    assert.equal(resolvePublicLimit(undefined, 9), 9);
    assert.equal(resolvePublicLimit("100", 12), 12);
    assert.equal(resolvePublicLimit("-3", 12), 12);
    assert.equal(resolvePublicLimit("abc", 12), 12);
  });
});
