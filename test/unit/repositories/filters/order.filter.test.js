import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOrderFilter } from "../../../../src/repositories/filters/order.filter.js";
import { id } from "../../../helpers/factories.js";

describe("order.filter (buildOrderFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildOrderFilter(), {});
  });

  it("scopes to a single user directly", () => {
    const userId = id();
    assert.equal(buildOrderFilter({ user: userId }).user, userId);
  });

  it("filters by a single status", () => {
    assert.equal(buildOrderFilter({ status: "shipped" }).status, "shipped");
  });

  it("statusIn takes precedence over (overwrites) a single status when both are given", () => {
    const filter = buildOrderFilter({ status: "shipped", statusIn: ["pending", "processing"] });
    assert.deepEqual(filter.status, { $in: ["pending", "processing"] });
  });

  describe("date range", () => {
    it("dateFrom uses $gte (inclusive)", () => {
      const from = new Date("2026-01-01");
      const filter = buildOrderFilter({ dateFrom: from });
      assert.deepEqual(filter.createdAt, { $gte: from });
    });

    it("dateTo uses $lt (exclusive - the whole day, not cutting off mid-day)", () => {
      const to = new Date("2026-02-01");
      const filter = buildOrderFilter({ dateTo: to });
      assert.deepEqual(filter.createdAt, { $lt: to });
    });

    it("combines both bounds", () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-02-01");
      const filter = buildOrderFilter({ dateFrom: from, dateTo: to });
      assert.deepEqual(filter.createdAt, { $gte: from, $lt: to });
    });
  });

  describe("total price range", () => {
    it("applies both bounds", () => {
      const filter = buildOrderFilter({ minTotal: 1000, maxTotal: 5000 });
      assert.deepEqual(filter.totalPrice, { $gte: 1000, $lte: 5000 });
    });

    it("a minTotal of 0 still applies", () => {
      const filter = buildOrderFilter({ minTotal: 0 });
      assert.deepEqual(filter.totalPrice, { $gte: 0 });
    });
  });

  it("search matches contact snapshot fields and line-item titles, not a $lookup", () => {
    const filter = buildOrderFilter({ search: "marko" });
    assert.equal(filter.$or.length, 4);
    assert.deepEqual(filter.$or[0], { "contactSnapshot.firstName": { $regex: "marko", $options: "i" } });
    assert.deepEqual(filter.$or[3], { "items.title": { $regex: "marko", $options: "i" } });
  });

  it("filters by explicit ids via $in", () => {
    const ids = [id(), id()];
    assert.deepEqual(buildOrderFilter({ ids })._id, { $in: ids });
  });

  it("ignores an empty ids array", () => {
    assert.equal("_id" in buildOrderFilter({ ids: [] }), false);
  });
});