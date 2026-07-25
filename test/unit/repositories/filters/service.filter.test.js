import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildServiceFilter } from "../../../../src/repositories/filters/service.filter.js";
import { id } from "../../../helpers/factories.js";

describe("service.filter (buildServiceFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildServiceFilter(), {});
  });

  it("search matches name OR shortDescription, case-insensitively", () => {
    const filter = buildServiceFilter({ search: "masaza" });
    assert.deepEqual(filter.$or, [
      { name: { $regex: "masaza", $options: "i" } },
      { shortDescription: { $regex: "masaza", $options: "i" } },
    ]);
  });

  it("filters by category - used to block Category deletion while a Service still references it", () => {
    const categoryId = id();
    assert.equal(buildServiceFilter({ category: categoryId }).categories, categoryId);
  });

  it("filters by tag", () => {
    const tagId = id();
    assert.equal(buildServiceFilter({ tag: tagId }).tags, tagId);
  });

  it("filters by isActive:true", () => {
    assert.equal(buildServiceFilter({ isActive: true }).isActive, true);
  });

  it("filters by isActive:false - not treated the same as omitted", () => {
    assert.equal(buildServiceFilter({ isActive: false }).isActive, false);
  });

  it("ignores isActive when null or undefined", () => {
    assert.equal("isActive" in buildServiceFilter({ isActive: null }), false);
    assert.equal("isActive" in buildServiceFilter({ isActive: undefined }), false);
  });

  it("filters by highlight:true", () => {
    assert.equal(buildServiceFilter({ highlight: true }).highlight, true);
  });

  it("filters by highlight:false - not treated the same as omitted", () => {
    assert.equal(buildServiceFilter({ highlight: false }).highlight, false);
  });

  it("ignores highlight when null or undefined", () => {
    assert.equal("highlight" in buildServiceFilter({ highlight: null }), false);
    assert.equal("highlight" in buildServiceFilter({ highlight: undefined }), false);
  });

  it("combines multiple filters at once", () => {
    const categoryId = id();
    const filter = buildServiceFilter({ category: categoryId, isActive: true, highlight: true });
    assert.deepEqual(filter, {
      categories: categoryId,
      isActive: true,
      highlight: true,
    });
  });
});