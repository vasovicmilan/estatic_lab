import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareBusinessReportDetailData,
  prepareBusinessReportDashboardData,
  prepareBusinessReportHistoryData,
  SORT_MAP,
} from "../../../../../src/presenters/admin/reports/business-report.presenter.js";

function summaryWithPackages(packages, overrides = {}) {
  return {
    periodType: "monthly",
    periodKey: "2026-09",
    generatedAt: new Date(),
    appointments: { total: 10, revenue: 30000, noShowRate: 5, byStatus: [], byService: [], byEmployee: [] },
    orders: { total: 4, revenue: 12000, avgOrderValue: 3000, byStatus: [], byProduct: [] },
    packages,
    commissions: { employeeEarned: 0, employeePaid: 0, partnerEarned: 0, partnerPaid: 0 },
    coupons: { totalRedemptions: 0, totalDiscountGiven: 0, byCoupon: [] },
    ...overrides,
  };
}

const FULL_PACKAGES = {
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
};

describe("business-report.presenter (admin) - sold packages calculation", () => {
  it("shows the package calculation: gross value, discounts, collected, per-package rows", () => {
    const { summary } = prepareBusinessReportDetailData(summaryWithPackages(FULL_PACKAGES));

    assert.equal(summary.packages.hasBreakdown, true);
    assert.equal(summary.packages.grossValue, "36000 RSD");
    assert.equal(summary.packages.discountTotal, "6000 RSD");
    assert.equal(summary.packages.revenue, "30000 RSD");
    assert.equal(summary.packages.avgPrice, "7500 RSD");
    assert.equal(summary.packages.cancelledValue, "7500 RSD");
    assert.equal(summary.packages.sessionsSold, 24);
    assert.equal(summary.packages.sessionsRedeemed, 9);
    assert.deepEqual(summary.packages.byPackage, [{ label: "Paket 6 seansi", count: 4, value: "30000 RSD" }]);
  });

  it("REGRESSION: renders an old stored summary (only totalPurchased + revenue) without throwing and flags it as having no breakdown", () => {
    const { summary } = prepareBusinessReportDetailData(summaryWithPackages({ totalPurchased: 2, revenue: 15000 }));

    assert.equal(summary.packages.hasBreakdown, false);
    assert.equal(summary.packages.revenue, "15000 RSD");
    assert.deepEqual(summary.packages.byPackage, []);
  });

  it("includes a combined total that adds the package money to appointments and shop", () => {
    const { summary } = prepareBusinessReportDetailData(summaryWithPackages(FULL_PACKAGES));

    // 30000 appointments + 12000 shop + 30000 packages (each only while its module is enabled)
    assert.equal(summary.totals.packages, "30000 RSD");
    assert.ok(summary.totals.total.endsWith("RSD"));
  });

  it("also carries the total on the live dashboard cards", () => {
    const view = prepareBusinessReportDashboardData({
      daily: null,
      weekly: null,
      monthly: summaryWithPackages(FULL_PACKAGES, { isLive: true }),
      quarterly: null,
      yearly: null,
    });

    const monthly = view.periods.find((p) => p.periodType === "monthly").summary;
    assert.ok(monthly.totals.total);
    assert.equal(monthly.packages.totalPurchased, 4);
  });
});

describe("business-report.presenter (admin) - history sorting", () => {
  const result = { data: [summaryWithPackages(FULL_PACKAGES, { periodKey: "2026-08" })], page: 1, totalPages: 1, limit: 25, total: 1 };

  it("flags the stored numeric columns sortable, but not the derived combined total", () => {
    const view = prepareBusinessReportHistoryData("monthly", result, {});
    const byKey = Object.fromEntries(view.columns.map((c) => [c.key, c]));

    assert.equal(byKey.period.sortable, true);
    assert.equal(byKey.prihodTermina.sortable, true);
    assert.equal(byKey.prihodPaketa.sortable, true);
    assert.equal(byKey.ukupanPrihod.sortable, undefined, "ukupanPrihod is computed, not a stored field to ORDER BY");
  });

  it("every sortable column maps to a real nested field on the summary document", () => {
    assert.equal(SORT_MAP.prihodPaketa, "packages.revenue");
    assert.equal(SORT_MAP.paketaUkupno, "packages.totalPurchased");
    assert.equal(SORT_MAP.period, "periodKey");
  });

  it("reports the active sort so the header arrow can be drawn, and ignores unknown columns", () => {
    const active = prepareBusinessReportHistoryData("monthly", result, { sortBy: "prihodPaketa", sortDir: "asc" });
    assert.deepEqual(active.sort, { by: "prihodPaketa", dir: "asc" });

    const bogus = prepareBusinessReportHistoryData("monthly", result, { sortBy: "$where", sortDir: "asc" });
    assert.equal(bogus.sort, null);
  });

  it("history rows carry the package columns and the combined total", () => {
    const row = prepareBusinessReportHistoryData("monthly", result, {}).items[0];

    assert.equal(row.paketaUkupno, 4);
    assert.equal(row.prihodPaketa, "30000 RSD");
    assert.ok(row.ukupanPrihod.endsWith("RSD"));
  });
});
