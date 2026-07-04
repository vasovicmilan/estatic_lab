import Coupon from "../models/coupon.model.js";
import { buildCouponFilter } from "./filters/coupon.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createCoupon(data, { session } = {}) {
  const [coupon] = await Coupon.create([data], { session });
  return coupon;
}

export async function findCouponById(id, { session } = {}) {
  return Coupon.findById(id).session(session || null).lean();
}

export async function findCouponByCode(code, { session } = {}) {
  return Coupon.findOne({ code: code.toUpperCase().trim() }).session(session || null).lean();
}

// count how many times one specific user has already redeemed this coupon —
// used to enforce maxUsesPerUser before opening the booking transaction (read-only check)
export async function countCouponUsagesByUser(couponId, userId, { session } = {}) {
  const result = await Coupon.aggregate([
    { $match: { _id: couponId } },
    { $project: { count: { $size: { $filter: {
      input: "$usageHistory",
      as: "u",
      cond: { $eq: ["$$u.user", userId] },
    } } } } },
  ]).session(session || null);
  return result[0]?.count || 0;
}

/**
 * Atomically records one redemption: pushes the usage entry and increments the running
 * counter in a single update, so it's safe to call inside the same transaction that
 * creates the Appointment — two concurrent redemptions can't silently overwrite each
 * other's $inc.
 */
export async function redeemCoupon(couponId, { userId, appointmentId, discountAmount }, { session } = {}) {
  return Coupon.findByIdAndUpdate(
    couponId,
    {
      $inc: { usedCount: 1 },
      $push: { usageHistory: { user: userId, appointment: appointmentId, discountAmount, usedAt: new Date() } },
    },
    { new: true, session }
  ).lean();
}

export async function findCoupons({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildCouponFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    Coupon.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateCouponById(id, updateData, { session } = {}) {
  return Coupon.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteCouponById(id, { session } = {}) {
  return Coupon.findByIdAndDelete(id, { session }).lean();
}

export async function countCoupons(filters = {}, { session } = {}) {
  return Coupon.countDocuments(buildCouponFilter(filters)).session(session || null);
}
