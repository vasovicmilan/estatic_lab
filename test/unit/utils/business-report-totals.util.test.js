import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getReportTotals, getPackageBreakdown } from "../../../src/utils/business-report-totals.util.js";

const ALL = { booking: true, shop: true };

describe("business-report-totals.util", () => {
  describe("getReportTotals", () => {
    it("adds appointments + shop + packages into one total", () => {
      const totals = getReportTotals({ appointments: { revenue: 30000 }, orders: { revenue: 12000 }, packages: { revenue: 8000 } }, ALL);

      assert.deepEqual(totals, { appointments: 30000, orders: 12000, packages: 8000, total: 50000 });
    });

    it("leaves out the sources of a disabled module, same as the report sections", () => {
      const summary = { appointments: { revenue: 30000 }, orders: { revenue: 12000 }, packages: { revenue: 8000 } };

      assert.equal(getReportTotals(summary, { booking: false, shop: true }).total, 12000);
      assert.equal(getReportTotals(summary, { booking: true, shop: false }).total, 38000);
    });

    it("treats missing sections as 0 instead of producing NaN", () => {
      assert.equal(getReportTotals({}, ALL).total, 0);
      assert.equal(getReportTotals({ appointments: { revenue: undefined }, packages: {} }, ALL).total, 0);
    });
  });

  describe("getPackageBreakdown", () => {
    it("passes through the full breakdown and derives the average package price", () => {
      const p = getPackageBreakdown({
        totalPurchased: 4,
        revenue: 30000,
        grossValue: 36000,
        discountTotal: 6000,
        couponPurchases: 2,
        sessionsSold: 24,
        sessionsRedeemed: 9,
        cancelledCount: 1,
        cancelledValue: 7500,
        byPackage: [{ label: "Paket 6 seansi", count: 4, value: 30000 }],
      });

      assert.equal(p.hasBreakdown, true);
      assert.equal(p.avgPrice, 7500);
      // the calculation the report shows: list value - discounts = collected
      assert.equal(p.grossValue - p.discountTotal, p.revenue);
      assert.equal(p.byPackage.length, 1);
    });

    it("REGRESSION: a summary saved before the breakdown existed (only totalPurchased + revenue) does not claim a made-up 0 discount", () => {
      const p = getPackageBreakdown({ totalPurchased: 2, revenue: 15000 });

      assert.equal(p.hasBreakdown, false, "the view must be able to tell it has no breakdown");
      assert.equal(p.revenue, 15000);
      assert.equal(p.sessionsSold, 0);
      assert.deepEqual(p.byPackage, []);
    });

    it("has a 0 average (not NaN/Infinity) when nothing was sold", () => {
      assert.equal(getPackageBreakdown({ totalPurchased: 0, revenue: 0, grossValue: 0, discountTotal: 0 }).avgPrice, 0);
      assert.equal(getPackageBreakdown(undefined).avgPrice, 0);
    });
  });
});
