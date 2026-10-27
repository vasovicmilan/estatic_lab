import BusinessReportSummary from "../models/business-report-summary.model.js";
import Appointment from "../models/appointment.model.js";
import Order from "../models/order.model.js";
import PackagePurchase from "../models/package-purchase.model.js";
import CommissionEntry from "../models/commission-entry.model.js";
import PayoutRequest from "../models/payout-request.model.js";
import Coupon from "../models/coupon.model.js";

const TOP_N = 10; // cap on byService/byEmployee/byProduct/byCoupon breakdown lists

export async function aggregateAppointments(periodStart, periodEnd) {
  const [byStatus, revenueAgg, byService, byEmployee] = await Promise.all([
    Appointment.aggregate([
      { $match: { startTime: { $gte: periodStart, $lt: periodEnd } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // The period's TOTAL revenue has to come from its own un-limited sum. It used
    // to be derived by adding up the byService rows below, but those are capped at
    // TOP_N (10) - any period with more than 10 distinct service variants silently
    // under-reported its revenue by whatever the 11th+ variants earned.
    // Package-paid appointments are stored with finalPrice 0 (the money was booked
    // when the package was sold - see aggregatePackages), so they add nothing here
    // and nothing is counted twice.
    Appointment.aggregate([
      { $match: { startTime: { $gte: periodStart, $lt: periodEnd }, status: "completed" } },
      { $group: { _id: null, revenue: { $sum: "$finalPrice" } } },
    ]),
    Appointment.aggregate([
      { $match: { startTime: { $gte: periodStart, $lt: periodEnd }, status: "completed" } },
      { $group: { _id: "$variant.name", count: { $sum: 1 }, value: { $sum: "$finalPrice" } } },
      { $sort: { value: -1 } },
      { $limit: TOP_N },
    ]),
    Appointment.aggregate([
      { $match: { startTime: { $gte: periodStart, $lt: periodEnd }, status: "completed", employee: { $ne: null } } },
      { $lookup: { from: "employees", localField: "employee", foreignField: "_id", as: "employeeDoc" } },
      { $unwind: { path: "$employeeDoc", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "employeeDoc.userId", foreignField: "_id", as: "userDoc" } },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$employee",
          name: { $first: { $concat: [{ $ifNull: ["$userDoc.firstName", "?"] }, " ", { $ifNull: ["$userDoc.lastName", ""] }] } },
          count: { $sum: 1 },
          value: { $sum: "$finalPrice" },
        },
      },
      { $sort: { value: -1 } },
      { $limit: TOP_N },
    ]),
  ]);

  const total = byStatus.reduce((sum, row) => sum + row.count, 0);
  const completedCount = byStatus.find((r) => r._id === "completed")?.count || 0;
  const noShowCount = byStatus.find((r) => r._id === "no_show")?.count || 0;
  const settledCount = completedCount + noShowCount; // no-show rate is meaningless against pending/future appointments
  const revenue = revenueAgg[0]?.revenue || 0;

  return {
    total,
    byStatus: byStatus.map((r) => ({ label: r._id || "unknown", count: r.count })),
    revenue,
    byService: byService.map((r) => ({ label: r._id || "Nepoznata usluga", count: r.count, value: r.value || 0 })),
    byEmployee: byEmployee.map((r) => ({ label: (r.name || "").trim() || "Nepoznat", count: r.count, value: r.value || 0 })),
    noShowRate: settledCount > 0 ? Math.round((noShowCount / settledCount) * 10000) / 100 : 0,
  };
}

export async function aggregateOrders(periodStart, periodEnd) {
  const [byStatus, byProduct] = await Promise.all([
    Order.aggregate([{ $match: { createdAt: { $gte: periodStart, $lt: periodEnd } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: periodStart, $lt: periodEnd }, status: "completed" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.title", count: { $sum: "$items.quantity" }, value: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { value: -1 } },
      { $limit: TOP_N },
    ]),
  ]);

  const total = byStatus.reduce((sum, row) => sum + row.count, 0);
  const completedCount = byStatus.find((r) => r._id === "completed")?.count || 0;

  const revenueAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: periodStart, $lt: periodEnd }, status: "completed" } },
    { $group: { _id: null, revenue: { $sum: "$totalPrice" } } },
  ]);
  const revenue = revenueAgg[0]?.revenue || 0;

  return {
    total,
    byStatus: byStatus.map((r) => ({ label: r._id || "unknown", count: r.count })),
    revenue,
    avgOrderValue: completedCount > 0 ? Math.round((revenue / completedCount) * 100) / 100 : 0,
    byProduct: byProduct.map((r) => ({ label: r._id || "Nepoznat proizvod", count: r.count, value: r.value || 0 })),
  };
}

/**
 * The package "calculation" for a period. A package is paid for up-front, so its
 * money is recognized here, in the period it was SOLD (cash basis) - the
 * appointments later booked against it are stored with finalPrice 0 and so never
 * add to appointments.revenue (no double counting). What the report shows:
 *
 *   grossValue (sum of originalPrice - the list price of what was sold)
 *   - discountTotal (sum of discountApplied - coupon / bundle discount given)
 *   = revenue (sum of pricePaid - what was actually collected)
 *
 * Cancelled purchases are left out of all of the above (the sale was undone) and
 * reported on their own (cancelledCount / cancelledValue) so the reduction is
 * visible instead of silently missing. sessionsRedeemed is how many package
 * sessions were actually delivered (completed appointments paid from a package)
 * in the period - a different question from what was sold in it.
 */
export async function aggregatePackages(periodStart, periodEnd) {
  const soldInPeriod = { createdAt: { $gte: periodStart, $lt: periodEnd } };

  const [totalsAgg, cancelledAgg, byPackage, redeemedAgg] = await Promise.all([
    PackagePurchase.aggregate([
      { $match: { ...soldInPeriod, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: "$pricePaid" },
          grossValue: { $sum: "$originalPrice" },
          discountTotal: { $sum: "$discountApplied" },
          // `$gt: [x, null]` is true only for a real value - it is false for both null and a missing field
          couponPurchases: { $sum: { $cond: [{ $gt: ["$coupon", null] }, 1, 0] } },
          sessionsSold: { $sum: { $sum: "$items.sessionsTotal" } },
        },
      },
    ]),
    PackagePurchase.aggregate([
      { $match: { ...soldInPeriod, status: "cancelled" } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$pricePaid" } } },
    ]),
    PackagePurchase.aggregate([
      { $match: { ...soldInPeriod, status: { $ne: "cancelled" } } },
      { $group: { _id: "$package", count: { $sum: 1 }, value: { $sum: "$pricePaid" } } },
      { $sort: { value: -1, count: -1 } },
      { $limit: TOP_N },
      { $lookup: { from: "packages", localField: "_id", foreignField: "_id", as: "packageDoc" } },
      { $unwind: { path: "$packageDoc", preserveNullAndEmptyArrays: true } },
      { $project: { count: 1, value: 1, name: "$packageDoc.name" } },
    ]),
    Appointment.aggregate([
      { $match: { startTime: { $gte: periodStart, $lt: periodEnd }, status: "completed", packagePurchase: { $ne: null } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
  ]);

  const totals = totalsAgg[0] || {};
  return {
    totalPurchased: totals.total || 0,
    revenue: totals.revenue || 0,
    grossValue: totals.grossValue || 0,
    discountTotal: totals.discountTotal || 0,
    couponPurchases: totals.couponPurchases || 0,
    sessionsSold: totals.sessionsSold || 0,
    sessionsRedeemed: redeemedAgg[0]?.count || 0,
    cancelledCount: cancelledAgg[0]?.count || 0,
    cancelledValue: cancelledAgg[0]?.value || 0,
    byPackage: byPackage.map((r) => ({ label: r.name || "Obrisan paket", count: r.count, value: r.value || 0 })),
  };
}

export async function aggregateCommissions(periodStart, periodEnd) {
  // CommissionEntry only tracks pending/earned/reversed - "paid" isn't a
  // CommissionEntry status at all, it's tracked separately on PayoutRequest
  // (see payout-request.model.js) once an admin actually pays someone out. So
  // "earned" here comes from CommissionEntry (commission recognized this
  // period, regardless of when it gets paid out), while "paid" comes from a
  // completely different collection (payouts actually disbursed this period,
  // regardless of which period originally earned that commission) - these two
  // numbers are answering genuinely different questions and are not meant to
  // reconcile against each other within the same period.
  const earnedRows = await CommissionEntry.aggregate([
    { $match: { createdAt: { $gte: periodStart, $lt: periodEnd }, status: "earned" } },
    { $group: { _id: "$earnerType", amount: { $sum: "$amount" } } },
  ]);
  const paidRows = await PayoutRequest.aggregate([
    { $match: { paidAt: { $gte: periodStart, $lt: periodEnd }, status: "paid" } },
    { $group: { _id: "$earnerType", amount: { $sum: "$amount" } } },
  ]);

  const sum = (rows, earnerType) => rows.find((r) => r._id === earnerType)?.amount || 0;

  return {
    employeeEarned: sum(earnedRows, "employee"),
    employeePaid: sum(paidRows, "employee"),
    partnerEarned: sum(earnedRows, "partner"),
    partnerPaid: sum(paidRows, "partner"),
  };
}

export async function aggregateCoupons(periodStart, periodEnd) {
  const rows = await Coupon.aggregate([
    { $unwind: "$usageHistory" },
    { $match: { "usageHistory.usedAt": { $gte: periodStart, $lt: periodEnd } } },
    { $group: { _id: "$code", count: { $sum: 1 }, value: { $sum: "$usageHistory.discountAmount" } } },
    { $sort: { value: -1 } },
  ]);

  const totalRedemptions = rows.reduce((sum, r) => sum + r.count, 0);
  const totalDiscountGiven = rows.reduce((sum, r) => sum + r.value, 0);

  return {
    totalRedemptions,
    totalDiscountGiven,
    byCoupon: rows.slice(0, TOP_N).map((r) => ({ label: r._id, count: r.count, value: r.value })),
  };
}

export async function upsertSummary(periodType, periodKey, data) {
  // .lean() is required here, not optional: the only consumer of this
  // function's return value (email.service.js's sendBusinessReportEmail)
  // does `{ periodLabel, dateRangeLabel, ...summary }` to build the EJS
  // template locals. Spreading a hydrated Mongoose Document only copies its
  // own enumerable properties ($__, _doc) - schema fields like `appointments`
  // live inside _doc and vanish from the spread, not merely as `undefined`
  // but as an absent key, which is why the template failed with "appointments
  // is not defined" rather than a "cannot read property of undefined" error.
  // findSummary/listSummaries below already use .lean() for the same reason.
  return BusinessReportSummary.findOneAndUpdate({ periodType, periodKey }, data, {
    upsert: true,
    returnDocument: "after",
    setDefaultsOnInsert: true,
  }).lean();
}

export async function findSummary(periodType, periodKey) {
  return BusinessReportSummary.findOne({ periodType, periodKey }).lean();
}

export async function listSummaries(periodType, { limit = 20, page = 1, sort = { periodKey: -1 } } = {}) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    BusinessReportSummary.find({ periodType }).sort(sort).skip(skip).limit(limit).lean(),
    BusinessReportSummary.countDocuments({ periodType }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export default {
  aggregateAppointments,
  aggregateOrders,
  aggregatePackages,
  aggregateCommissions,
  aggregateCoupons,
  upsertSummary,
  findSummary,
  listSummaries,
};
