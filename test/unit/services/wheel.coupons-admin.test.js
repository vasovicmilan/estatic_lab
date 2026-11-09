import { describe, it } from "node:test";
import assert from "node:assert/strict";
import wheelService from "../../../src/services/wheel.service.js";
import wheelPrizeRepo from "../../../src/repositories/wheel-prize.repository.js";
import leadRepo from "../../../src/repositories/lead.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import { buildCouponFilter } from "../../../src/repositories/filters/coupon.filter.js";
import { id } from "../../helpers/factories.js";

describe("wheel coupons - separate admin view", () => {
  it("lists only wheel coupons, joined with the winner and the prize label, with usage state", async (t) => {
    const usedId = id();
    const freeId = id();
    const flagged = [];
    t.mock.method(leadRepo, "allCouponIds", async () => [usedId]);
    t.mock.method(couponRepo, "markCouponsAsWheel", async (ids) => { flagged.push(...ids); return {}; });
    let passedFilters;
    t.mock.method(couponRepo, "findCoupons", async ({ filters }) => {
      passedFilters = filters;
      return {
        data: [
          { _id: usedId, code: "TOCAK-AAAAAA", usedCount: 1, maxUses: 1, isActive: true, validUntil: new Date(Date.now() + 864e5), wheelPrizeKey: "popust-10" },
          { _id: freeId, code: "TOCAK-BBBBBB", usedCount: 0, maxUses: 1, isActive: true, validUntil: new Date(Date.now() + 864e5), wheelPrizeKey: "popust-20" },
        ],
        total: 2, page: 1, limit: 10, totalPages: 1,
      };
    });
    t.mock.method(leadRepo, "findLeadsByCouponIds", async () => [{ coupon: usedId, firstName: "Ana", email: "ana@example.com" }]);
    t.mock.method(wheelPrizeRepo, "findAllPrizes", async () => [{ key: "popust-10", label: "10% popusta" }, { key: "popust-20", label: "20% popusta" }]);

    const res = await wheelService.listWheelCoupons({ filters: { prize: "popust-10" } });

    assert.equal(passedFilters.origin, "wheel");
    assert.equal(passedFilters.wheelPrizeKey, "popust-10");
    assert.deepEqual(flagged.map(String), [String(usedId)], "legacy wheel coupons get flagged");
    assert.equal(res.data[0].status, "Iskorišćen");
    assert.equal(res.data[0].nagrada, "10% popusta");
    assert.match(res.data[0].dobitnik, /ana@example.com/);
    assert.equal(res.data[1].status, "Aktivan");
    assert.equal(res.data[1].dobitnik, "-");
  });

  it("an unused coupon past its date is shown as expired", async (t) => {
    t.mock.method(leadRepo, "allCouponIds", async () => []);
    t.mock.method(couponRepo, "markCouponsAsWheel", async () => ({}));
    t.mock.method(couponRepo, "findCoupons", async () => ({
      data: [{ _id: id(), code: "TOCAK-CCCCCC", usedCount: 0, maxUses: 1, isActive: true, validUntil: new Date(Date.now() - 864e5), wheelPrizeKey: "popust-10" }],
      total: 1, page: 1, limit: 10, totalPages: 1,
    }));
    t.mock.method(leadRepo, "findLeadsByCouponIds", async () => []);
    t.mock.method(wheelPrizeRepo, "findAllPrizes", async () => []);
    const res = await wheelService.listWheelCoupons();
    assert.equal(res.data[0].status, "Istekao");
  });
});

describe("coupon.filter - origin / state", () => {
  it("excludeOrigin keeps wheel coupons out of the main list (and matches legacy docs without the field)", () => {
    assert.deepEqual(buildCouponFilter({ excludeOrigin: "wheel" }).origin, { $ne: "wheel" });
  });
  it("origin + prize + state build the wheel view filter", () => {
    const f = buildCouponFilter({ origin: "wheel", wheelPrizeKey: "popust-15", state: "used" });
    assert.equal(f.origin, "wheel");
    assert.equal(f.wheelPrizeKey, "popust-15");
    assert.deepEqual(f.usedCount, { $gte: 1 });
  });
  it("state=expired is unused AND past validUntil; state=active is unused, active and not past", () => {
    const expired = buildCouponFilter({ state: "expired" });
    assert.equal(expired.usedCount, 0);
    assert.ok(expired.validUntil.$lt instanceof Date);
    const active = buildCouponFilter({ state: "active" });
    assert.equal(active.isActive, true);
    assert.ok(active.validUntil.$gte instanceof Date);
  });
});
