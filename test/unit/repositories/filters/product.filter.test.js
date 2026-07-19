import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProductFilter } from "../../../../src/repositories/filters/product.filter.js";
import { id } from "../../../helpers/factories.js";

describe("product.filter (buildProductFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildProductFilter(), {});
  });

  it("builds a case-insensitive $or regex search across name/sku/shortDescription", () => {
    const filter = buildProductFilter({ search: "esma" });
    assert.equal(filter.$or.length, 3);
    assert.deepEqual(filter.$or[0], { name: { $regex: "esma", $options: "i" } });
  });

  it("lowercases and trims an exact sku filter", () => {
    const filter = buildProductFilter({ sku: "  ESMA-001  " });
    assert.equal(filter.sku, "esma-001");
  });

  it("filters by category and tag as direct equality (array membership)", () => {
    const categoryId = id();
    const tagId = id();
    const filter = buildProductFilter({ category: categoryId, tag: tagId });
    assert.equal(filter.categories, categoryId);
    assert.equal(filter.tags, tagId);
  });

  it("only sets isActive when explicitly true or false, not for null/undefined (don't restrict by default)", () => {
    assert.equal(buildProductFilter({ isActive: true }).isActive, true);
    assert.equal(buildProductFilter({ isActive: false }).isActive, false);
    assert.equal("isActive" in buildProductFilter({ isActive: null }), false);
    assert.equal("isActive" in buildProductFilter(), false);
  });

  it("sets the badge filter only when a value is given", () => {
    assert.equal(buildProductFilter({ badge: "featured" }).badge, "featured");
    assert.equal("badge" in buildProductFilter(), false);
  });

  describe("inStock - checked at the variation level, not a product-level field", () => {
    it("inStock: true requires at least one active variation with stock > 0", () => {
      const filter = buildProductFilter({ inStock: true });
      assert.deepEqual(filter.variations, { $elemMatch: { stock: { $gt: 0 }, isActive: true } });
    });

    it("inStock: false is the logical negation, not just 'stock is 0'", () => {
      const filter = buildProductFilter({ inStock: false });
      assert.deepEqual(filter.variations, { $not: { $elemMatch: { stock: { $gt: 0 }, isActive: true } } });
    });

    it("omits the variations filter entirely when inStock isn't specified", () => {
      assert.equal("variations" in buildProductFilter(), false);
    });
  });

  describe("price range", () => {
    it("applies both bounds on variations.price when both are given", () => {
      const filter = buildProductFilter({ minPrice: 1000, maxPrice: 5000 });
      assert.deepEqual(filter["variations.price"], { $gte: 1000, $lte: 5000 });
    });

    it("applies only the lower bound when maxPrice is omitted", () => {
      const filter = buildProductFilter({ minPrice: 1000 });
      assert.deepEqual(filter["variations.price"], { $gte: 1000 });
    });

    it("applies only the upper bound when minPrice is omitted", () => {
      const filter = buildProductFilter({ maxPrice: 5000 });
      assert.deepEqual(filter["variations.price"], { $lte: 5000 });
    });

    it("a minPrice of exactly 0 still applies (falsy but not undefined)", () => {
      const filter = buildProductFilter({ minPrice: 0 });
      assert.deepEqual(filter["variations.price"], { $gte: 0 });
    });
  });

  it("filters by a list of explicit ids via $in", () => {
    const ids = [id(), id()];
    const filter = buildProductFilter({ ids });
    assert.deepEqual(filter._id, { $in: ids });
  });

  it("ignores an empty ids array rather than producing an impossible $in: []", () => {
    assert.equal("_id" in buildProductFilter({ ids: [] }), false);
  });

  it("combines multiple filters together in one query", () => {
    const filter = buildProductFilter({ search: "uredjaj", isActive: true, inStock: true, minPrice: 500 });
    assert.ok(filter.$or);
    assert.equal(filter.isActive, true);
    assert.ok(filter.variations);
    assert.deepEqual(filter["variations.price"], { $gte: 500 });
  });
});