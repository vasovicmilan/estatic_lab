import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareBusinessReportDashboardData,
  prepareBusinessReportHistoryData,
  prepareBusinessReportDetailData,
} from "../../../../../src/presenters/admin/reports/business-report.presenter.js";

function fakeSummary(overrides = {}) {
  return {
    periodType: "monthly",
    periodKey: "2026-08",
    generatedAt: new Date(),
    appointments: { total: 10, revenue: 30000, noShowRate: 5, byStatus: [], byService: [], byEmployee: [] },
    orders: { total: 4, revenue: 12000, avgOrderValue: 3000, byStatus: [], byProduct: [] },
    packages: { totalPurchased: 1, revenue: 12000 },
    commissions: { employeeEarned: 1000, employeePaid: 500, partnerEarned: 2000, partnerPaid: 1000 },
    coupons: { totalRedemptions: 2, totalDiscountGiven: 500, byCoupon: [] },
    ...overrides,
  };
}

describe("business-report.presenter (admin)", () => {
  describe("prepareBusinessReportDashboardData", () => {
    it("includes all 5 period types even when most have no summary yet", () => {
      const view = prepareBusinessReportDashboardData({ daily: null, weekly: null, monthly: fakeSummary(), quarterly: null, yearly: null });

      assert.equal(view.periods.length, 5);
      assert.deepEqual(
        view.periods.map((p) => p.periodType),
        ["daily", "weekly", "monthly", "quarterly", "yearly"]
      );
      assert.equal(view.periods.find((p) => p.periodType === "monthly").summary.periodKey, "2026-08");
      assert.equal(view.periods.find((p) => p.periodType === "daily").summary, null);
    });

    it("formats revenue as a currency-aware display string, not a raw number", () => {
      const view = prepareBusinessReportDashboardData({
        daily: null,
        weekly: null,
        monthly: fakeSummary({ appointments: { total: 1, revenue: 3000, noShowRate: 0, byStatus: [], byService: [], byEmployee: [] } }),
        quarterly: null,
        yearly: null,
      });

      const monthly = view.periods.find((p) => p.periodType === "monthly");
      assert.equal(monthly.summary.appointments.revenue, "3000 RSD");
    });

    it("REGRESSION: marks a live (not-yet-persisted) current-period summary as isLive, so the dashboard can badge it", () => {
      const view = prepareBusinessReportDashboardData({
        daily: fakeSummary({ isLive: true }),
        weekly: null,
        monthly: null,
        quarterly: null,
        yearly: null,
      });

      assert.equal(view.periods.find((p) => p.periodType === "daily").summary.isLive, true);
    });
  });

  describe("prepareBusinessReportHistoryData", () => {
    it("formats each row's revenue and builds the correct detail URL", () => {
      const view = prepareBusinessReportHistoryData("weekly", { data: [fakeSummary({ periodKey: "2026-W34" })], page: 1, totalPages: 1 }, {});

      assert.equal(view.items[0].periodKey, "2026-W34");
      assert.equal(view.items[0].prihodTermina, "30000 RSD");
      assert.equal(view.items[0].detailUrl, "/admin/poslovni-izvestaji/istorija/weekly/2026-W34");
    });

    it("returns an empty item list without throwing when there's no history yet", () => {
      const view = prepareBusinessReportHistoryData("yearly", { data: [], page: 1, totalPages: 1 }, {});
      assert.deepEqual(view.items, []);
    });
  });

  describe("prepareBusinessReportDetailData", () => {
    it("formats every currency field across all 5 domains", () => {
      const view = prepareBusinessReportDetailData(fakeSummary());

      assert.equal(view.summary.appointments.revenue, "30000 RSD");
      assert.equal(view.summary.orders.avgOrderValue, "3000 RSD");
      assert.equal(view.summary.packages.revenue, "12000 RSD");
      assert.equal(view.summary.commissions.employeeEarned, "1000 RSD");
      assert.equal(view.summary.coupons.totalDiscountGiven, "500 RSD");
    });

    it("formats the value field within each breakdown row, not just the top-level totals", () => {
      const view = prepareBusinessReportDetailData(
        fakeSummary({ appointments: { total: 1, revenue: 3000, noShowRate: 0, byStatus: [], byService: [{ label: "Masaza", count: 1, value: 3000 }], byEmployee: [] } })
      );

      assert.equal(view.summary.appointments.byService[0].value, "3000 RSD");
      assert.equal(view.summary.appointments.byService[0].label, "Masaza");
    });

    it("gracefully returns a null summary (and a fallback backUrl) for a period that doesn't exist", () => {
      const view = prepareBusinessReportDetailData(null);

      assert.equal(view.summary, null);
      assert.equal(view.backUrl, "/admin/poslovni-izvestaji");
    });
  });
});
