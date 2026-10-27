import { formatMoney } from "../../../utils/price.util.js";
import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";
import { getReportTotals, getPackageBreakdown } from "../../../utils/business-report-totals.util.js";
import { FEATURES } from "../../../config/features.config.js";

// History table columns -> stored scalar fields on BusinessReportSummary. The
// combined "Ukupan prihod" column is derived (appointments + shop + packages),
// not a stored field, so it is displayed but not sortable. Same fields as
// api/v1 admin-ops.controller's BUSINESS_REPORT_SORT_FIELDS.
export const SORT_MAP = {
  period: "periodKey",
  terminaUkupno: "appointments.total",
  prihodTermina: "appointments.revenue",
  porudzbinaUkupno: "orders.total",
  prihodPorudzbina: "orders.revenue",
  paketaUkupno: "packages.totalPurchased",
  prihodPaketa: "packages.revenue",
};

const PERIOD_LABELS = {
  daily: "Dnevni",
  weekly: "Nedeljni",
  monthly: "Mesečni",
  quarterly: "Kvartalni",
  yearly: "Godišnji",
};

const PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

function formatPackagesForDisplay(packages) {
  const p = getPackageBreakdown(packages);
  return {
    totalPurchased: p.totalPurchased,
    revenue: formatMoney(p.revenue),
    grossValue: formatMoney(p.grossValue),
    discountTotal: formatMoney(p.discountTotal),
    couponPurchases: p.couponPurchases,
    sessionsSold: p.sessionsSold,
    sessionsRedeemed: p.sessionsRedeemed,
    cancelledCount: p.cancelledCount,
    cancelledValue: formatMoney(p.cancelledValue),
    avgPrice: formatMoney(p.avgPrice),
    byPackage: p.byPackage.map((r) => ({ ...r, value: formatMoney(r.value) })),
    // false for summaries saved before the breakdown existed - the view then says
    // so instead of showing a misleading "0 discount" line
    hasBreakdown: p.hasBreakdown,
  };
}

function formatTotalsForDisplay(summary) {
  const totals = getReportTotals(summary, FEATURES);
  return {
    appointments: formatMoney(totals.appointments),
    orders: formatMoney(totals.orders),
    packages: formatMoney(totals.packages),
    total: formatMoney(totals.total),
  };
}

function formatSummaryForDisplay(summary) {
  if (!summary) return null;
  return {
    periodType: summary.periodType,
    periodKey: summary.periodKey,
    periodLabel: PERIOD_LABELS[summary.periodType] || summary.periodType,
    generatedAt: summary.generatedAt,
    isLive: !!summary.isLive,
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
    packages: formatPackagesForDisplay(summary.packages),
    totals: formatTotalsForDisplay(summary),
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
 * side by side - `summariesByType` is an object keyed by periodType, each
 * value coming from businessReportService.getCurrentPeriodSummaryLive(), so
 * unlike a persisted summary lookup, these are never null: they're computed
 * fresh on every dashboard load (see that function's own doc comment for
 * why), same as the log dashboard's "today, live" card.
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

// Which module each history column belongs to - a deployment without the shop
// has no "Porudžbina" columns, one without booking has no appointments/packages
// (same gating as the detail page and the email/PDF).
const HISTORY_COLUMNS = [
  { key: "period", label: "Period", feature: null },
  { key: "terminaUkupno", label: "Termina", feature: "booking" },
  { key: "prihodTermina", label: "Prihod termina", feature: "booking" },
  { key: "porudzbinaUkupno", label: "Porudžbina", feature: "shop" },
  { key: "prihodPorudzbina", label: "Prihod prodavnice", feature: "shop" },
  { key: "paketaUkupno", label: "Prodato paketa", feature: "booking" },
  { key: "prihodPaketa", label: "Prihod paketa", feature: "booking" },
  { key: "ukupanPrihod", label: "Ukupan prihod", feature: null },
];

export function prepareBusinessReportHistoryData(periodType, result, query = {}) {
  const visibleColumns = HISTORY_COLUMNS.filter((c) => !c.feature || FEATURES[c.feature]).map(({ key, label }) => ({ key, label }));

  return {
    periodType,
    periodLabel: PERIOD_LABELS[periodType] || periodType,
    columns: markSortableColumns(visibleColumns, SORT_MAP),
    sort: buildSortState(query, SORT_MAP),
    items: result.data.map((s) => ({
      periodKey: s.periodKey,
      terminaUkupno: s.appointments?.total ?? 0,
      prihodTermina: formatMoney(s.appointments?.revenue ?? 0),
      porudzbinaUkupno: s.orders?.total ?? 0,
      prihodPorudzbina: formatMoney(s.orders?.revenue ?? 0),
      paketaUkupno: s.packages?.totalPurchased ?? 0,
      prihodPaketa: formatMoney(s.packages?.revenue ?? 0),
      ukupanPrihod: formatMoney(getReportTotals(s, FEATURES).total),
      detailUrl: `/admin/poslovni-izvestaji/istorija/${periodType}/${s.periodKey}`,
    })),
    pagination: buildAdminPagination(result, { basePath: `/admin/poslovni-izvestaji/istorija/${periodType}`, query }),
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
