import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPackageFilter } from "../../../../src/repositories/filters/package.filter.js";
import { id } from "../../../helpers/factories.js";

describe("package.filter (buildPackageFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildPackageFilter(), {});
  });

  it("search matches name OR shortDescription, case-insensitively", () => {
    const filter = buildPackageFilter({ search: "opustanje" });
    assert.deepEqual(filter.$or, [
      { name: { $regex: "opustanje", $options: "i" } },
      { shortDescription: { $regex: "opustanje", $options: "i" } },
    ]);
  });

  it("filters by category", () => {
    const categoryId = id();
    assert.equal(buildPackageFilter({ category: categoryId }).categories, categoryId);
  });

  it("filters by tag", () => {
    const tagId = id();
    assert.equal(buildPackageFilter({ tag: tagId }).tags, tagId);
  });

  it("filters by service - used to block Service deletion while a Package still references it", () => {
    const serviceId = id();
    assert.equal(buildPackageFilter({ service: serviceId })["items.service"], serviceId);
  });

  it("filters by isActive:true", () => {
    assert.equal(buildPackageFilter({ isActive: true }).isActive, true);
  });

  it("filters by isActive:false - not treated the same as omitted", () => {
    assert.equal(buildPackageFilter({ isActive: false }).isActive, false);
  });

  it("ignores isActive when null or undefined", () => {
    assert.equal("isActive" in buildPackageFilter({ isActive: null }), false);
    assert.equal("isActive" in buildPackageFilter({ isActive: undefined }), false);
  });

  it("combines multiple filters at once", () => {
    const categoryId = id();
    const serviceId = id();
    const filter = buildPackageFilter({ category: categoryId, service: serviceId, isActive: true });
    assert.deepEqual(filter, {
      categories: categoryId,
      "items.service": serviceId,
      isActive: true,
    });
  });
});