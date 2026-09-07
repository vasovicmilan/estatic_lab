import Coupon from "../models/coupon.model.js";
import { buildCouponFilter } from "./filters/coupon.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createCoupon(data, { session } = {}) {
  const [coupon] = await Coupon.create([data], { session });
  return coupon;
}

export async function findCouponById(id, { session } = {}) {
  return Coupon.findById(id)
    .populate("applicableServices", "name")
    .populate("applicablePackages", "name")
    .populate("productDiscount.applicableProducts", "name")
    .populate({ path: "partner", populate: { path: "userId", select: "firstName lastName" } })
    .session(session || null)
    .lean();
}

export async function findCouponByCode(code, { session } = {}) {
  return Coupon.findOne({ code: code.toUpperCase().trim() }).session(session || null).lean();
}

// count how many times one specific user has already redeemed this coupon -
// used to enforce maxUsesPerUser before opening the booking transaction (read-only check)
export async function countCouponUsagesByUser(couponId, userId, { session } = {}) {
  const result = await Coupon.aggregate([
    { $match: { _id: couponId } },
    {
      $project: {
        count: {
          $size: {
            $filter: {
              input: "$usageHistory",
              as: "u",
              cond: { $eq: ["$$u.user", userId] },
            },
          },
        },
      },
    },
  ]).session(session || null);
  return result[0]?.count || 0;
}

/**
 * Atomically records one redemption: pushes the usage entry and increments the running
 * counter in a single update, so it's safe to call inside the same transaction that
 * creates the Appointment (or, now, the same flow that records a PackagePurchase) -
 * two concurrent redemptions can't silently overwrite each other's $inc.
 *
 * BUG FIX: this used to be a plain findByIdAndUpdate with no condition on usedCount,
 * meaning the $inc itself never lost an update under concurrency, but nothing stopped
 * it from pushing usedCount past maxUses - two requests could both pass
 * coupon.service.js's validateCoupon() read (both seeing the coupon as still eligible)
 * and then both redeem here, exceeding a maxUses:1 coupon's cap. The increment being
 * atomic was necessary but not sufficient - the cap check has to live in the same
 * atomic operation as the increment, not in an earlier separate read. Now the query
 * itself only matches a coupon that's either uncapped (maxUses null) or still under
 * its cap, so at most one of two racing redemptions can ever succeed - the loser gets
 * null back (see coupon.service.js's redeemCoupon, which turns that into a proper
 * "already exhausted" error) instead of successfully double-spending the coupon.
 * maxUsesPerUser is NOT covered by this same atomicity yet - it's still enforced via
 * a separate countCouponUsagesByUser read in validateCoupon(), so the same class of
 * race is still theoretically possible there. Lower priority: worst case is one
 * person redeeming a personal-use coupon slightly more than once via a genuine
 * double-submit, not a shared cap being blown through by unrelated customers.
 */
export async function redeemCoupon(
  couponId,
  { userId, appointmentId = null, packagePurchaseId = null, orderId = null, discountAmount },
  { session } = {}
) {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }],
    },
    {
      $inc: { usedCount: 1 },
      $push: {
        usageHistory: {
          user: userId,
          appointment: appointmentId,
          packagePurchase: packagePurchaseId,
          order: orderId,
          discountAmount,
          usedAt: new Date(),
        },
      },
    },
    { returnDocument: "after", session }
  ).lean();
}

export async function findCoupons({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildCouponFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    Coupon.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateCouponById(id, updateData, { session } = {}) {
  return Coupon.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteCouponById(id, { session } = {}) {
  return Coupon.findByIdAndDelete(id, { session }).lean();
}

export async function countCoupons(filters = {}, { session } = {}) {
  return Coupon.countDocuments(buildCouponFilter(filters)).session(session || null);
}

// Called when a Service or Package is deleted - Coupon.applicableServices[]/
// applicablePackages[] is current targeting config, not a promise to anyone, so
// it's safe to auto-clean rather than block the deletion on it.
export async function pullServiceFromAllCoupons(serviceId, { session } = {}) {
  return Coupon.updateMany({ applicableServices: serviceId }, { $pull: { applicableServices: serviceId } }, { session });
}

export async function pullPackageFromAllCoupons(packageId, { session } = {}) {
  return Coupon.updateMany({ applicablePackages: packageId }, { $pull: { applicablePackages: packageId } }, { session });
}

export async function pullProductFromAllCoupons(productId, { session } = {}) {
  return Coupon.updateMany(
    { "productDiscount.applicableProducts": productId },
    { $pull: { "productDiscount.applicableProducts": productId } },
    { session }
  );
}

// Called when a Partner is deleted - Coupon.partner is current referral-attribution
// config (single ref, not an array, unlike applicableServices/applicablePackages
// above), not a promise to anyone. Safe to auto-clean: the coupon just becomes a
// plain non-referral discount code going forward.
export async function unsetPartnerFromAllCoupons(partnerId, { session } = {}) {
  return Coupon.updateMany({ partner: partnerId }, { $set: { partner: null } }, { session });
}

export default {
  createCoupon,
  findCouponById,
  findCouponByCode,
  countCouponUsagesByUser,
  redeemCoupon,
  findCoupons,
  updateCouponById,
  deleteCouponById,
  countCoupons,
  pullServiceFromAllCoupons,
  pullPackageFromAllCoupons,
  pullProductFromAllCoupons,
  unsetPartnerFromAllCoupons,
};