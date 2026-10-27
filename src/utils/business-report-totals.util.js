/**
 * The one place that turns a business-report summary into "how much did the
 * business actually take in" - shared by the admin presenter, the PDF and the
 * email so the three can never disagree.
 *
 * Revenue is recognized on a cash basis, per source:
 *   - appointments: finalPrice of COMPLETED appointments (package-paid ones are
 *     stored with finalPrice 0 - see business-report.repository.js)
 *   - shop:         totalPrice of COMPLETED orders
 *   - packages:     pricePaid of packages SOLD in the period (non-cancelled)
 *
 * Because package sessions carry no price when they are redeemed, the three
 * sources are disjoint and can simply be added up. Sources of a disabled module
 * (see features.config.js) are left out, exactly as the report sections are.
 *
 * Summaries stored before the package breakdown existed have no
 * grossValue/discountTotal/... - those read as 0 here, never as NaN.
 */

const num = (value) => Number(value) || 0;

export function getReportTotals(summary, features = { booking: true, shop: true }) {
  const appointments = features.booking ? num(summary?.appointments?.revenue) : 0;
  const orders = features.shop ? num(summary?.orders?.revenue) : 0;
  const packages = features.booking ? num(summary?.packages?.revenue) : 0;

  return {
    appointments,
    orders,
    packages,
    total: appointments + orders + packages,
  };
}

/**
 * The package "calculation" as plain numbers (list value - discount = collected),
 * with defaults for summaries saved before these fields existed.
 */
export function getPackageBreakdown(packages = {}) {
  const revenue = num(packages.revenue);
  const totalPurchased = num(packages.totalPurchased);
  const hasBreakdown = packages.grossValue !== undefined && packages.grossValue !== null;

  return {
    totalPurchased,
    revenue,
    // Old summaries never stored the gross value; the best honest answer is "same as collected, no known discount".
    grossValue: hasBreakdown ? num(packages.grossValue) : revenue,
    discountTotal: hasBreakdown ? num(packages.discountTotal) : 0,
    couponPurchases: num(packages.couponPurchases),
    sessionsSold: num(packages.sessionsSold),
    sessionsRedeemed: num(packages.sessionsRedeemed),
    cancelledCount: num(packages.cancelledCount),
    cancelledValue: num(packages.cancelledValue),
    avgPrice: totalPurchased > 0 ? Math.round((revenue / totalPurchased) * 100) / 100 : 0,
    byPackage: Array.isArray(packages.byPackage) ? packages.byPackage : [],
    hasBreakdown,
  };
}

export default { getReportTotals, getPackageBreakdown };
