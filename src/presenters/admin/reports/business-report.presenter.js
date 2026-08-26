import { formatMoney } from "../../../utils/price.util.js";

const PERIOD_LABELS = {
  daily: "Dnevni",
  weekly: "Nedeljni",
  monthly: "Mesečni",
  quarterly: "Kvartalni",
  yearly: "Godišnji",
};

const PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

function formatSummaryForDisplay(summary) {
  if (!summary) return null;
  return {
    periodType: summary.periodType,
    periodKey: summary.periodKey,
    periodLabel: PERIOD_LABELS[summary.periodType] || summary.periodType,
    generatedAt: summary.generatedAt,
    appointments: {
      ...summary.appointments,
      revenue: formatMoney(summary.appointments.revenue),
      byService: (summary.appointments.byService || []).map((r) => ({ ...r, value: formatMoney(r.value) })),
      byEmployee: (summary.appointments.byEmployee || []).map((r) => ({ ...r, value: formatMoney(r.value) })),
    },
    orders: {
      ...summary.orders,
      revenue: formatMoney(summary.orders.revenue),
      avgOrderValue: formatMoney(summary.orders.avgOrderValue),
      byProduct: (summary.orders.byProduct || []).map((r) => ({ ...r, value: formatMoney(r.value) })),
    },
    packages: {
      ...summary.packages,
      revenue: formatMoney(summary.packages.revenue),
    },
    commissions: {
      employeeEarned: formatMoney(summary.commissions.employeeEarned),
      employeePaid: formatMoney(summary.commissions.employeePaid),
      partnerEarned: formatMoney(summary.commissions.partnerEarned),
      partnerPaid: formatMoney(summary.commissions.partnerPaid),
    },
    coupons: {
      ...summary.coupons,
      totalDiscountGiven: formatMoney(summary.coupons.totalDiscountGiven),
      byCoupon: (summary.coupons.byCoupon || []).map((r) => ({ ...r, value: formatMoney(r.value) })),
    },
  };
}

/**
 * The main dashboard shows the CURRENT (in-progress) period for all 5 types
 * side by side - `summariesByType` is an object keyed by periodType, any of
 * which may be null if that period hasn't been generated yet (e.g. a brand
 * new deployment before the first cron tick, or a period type whose cron
 * hasn't fired yet this cycle).
 */
export function prepareBusinessReportDashboardData(summariesByType) {
  return {
    periods: PERIOD_TYPES.map((periodType) => ({
      periodType,
      label: PERIOD_LABELS[periodType],
      summary: formatSummaryForDisplay(summariesByType[periodType]),
      historyUrl: `/admin/poslovni-izvestaji/istorija/${periodType}`,
    })),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Poslovni izveštaji", url: null },
    ],
  };
}

export function prepareBusinessReportHistoryData(periodType, result, query = {}) {
  return {
    periodType,
    periodLabel: PERIOD_LABELS[periodType] || periodType,
    items: result.data.map((s) => ({
      periodKey: s.periodKey,
      terminaUkupno: s.appointments?.total ?? 0,
      prihodTermina: formatMoney(s.appointments?.revenue ?? 0),
      porudzbinaUkupno: s.orders?.total ?? 0,
      prihodPorudzbina: formatMoney(s.orders?.revenue ?? 0),
      detailUrl: `/admin/poslovni-izvestaji/istorija/${periodType}/${s.periodKey}`,
    })),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/admin/poslovni-izvestaji/istorija/${periodType}`,
      query,
    },
    dashboardUrl: "/admin/poslovni-izvestaji",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Poslovni izveštaji", url: "/admin/poslovni-izvestaji" },
      { label: `${PERIOD_LABELS[periodType] || periodType} - istorija`, url: null },
    ],
  };
}

export function prepareBusinessReportDetailData(summary) {
  const formatted = formatSummaryForDisplay(summary);
  return {
    summary: formatted,
    backUrl: formatted ? `/admin/poslovni-izvestaji/istorija/${formatted.periodType}` : "/admin/poslovni-izvestaji",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Poslovni izveštaji", url: "/admin/poslovni-izvestaji" },
      { label: `${formatted?.periodLabel || "Istorija"} - istorija`, url: formatted ? `/admin/poslovni-izvestaji/istorija/${formatted.periodType}` : null },
      { label: formatted?.periodKey || "Detalji", url: null },
    ],
  };
}

export default { prepareBusinessReportDashboardData, prepareBusinessReportHistoryData, prepareBusinessReportDetailData };
