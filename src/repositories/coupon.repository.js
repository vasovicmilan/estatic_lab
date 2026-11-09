import mongoose from "mongoose";
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
    .populate("productDiscount.excludedCategories", "name")
    .populate({ path: "partner", populate: { path: "userId", select: "firstName lastName" } })
    .session(session || null)
    .lean();
}

// admin "who used this coupon" view: usage + release history with people and the current status of
// the appointment/order/package each use belongs to (lean, read-only; kept apart from findCouponById
// so the populated user objects never leak into the validation/redeem code that reads usageHistory)
export async function findCouponUsageDetails(id) {
  return Coupon.findById(id, { code: 1, usedCount: 1, maxUses: 1, usageHistory: 1, releaseHistory: 1 })
    .populate("usageHistory.user", "firstName lastName email")
    .populate("usageHistory.appointment", "status")
    .populate("usageHistory.order", "status")
    .populate("usageHistory.packagePurchase", "status")
    .populate("releaseHistory.user", "firstName lastName email")
    .populate("releaseHistory.releasedBy", "firstName lastName")
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

// the usageHistory sub-document filter that identifies "the use belonging to this appointment/order/purchase"
// ids are cast explicitly: $pull / $not+$elemMatch must compare ObjectIds, and callers may hold strings
const oid = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));
function usageRef({ appointmentId = null, packagePurchaseId = null, orderId = null }) {
  if (appointmentId) return { appointment: oid(appointmentId) };
  if (orderId) return { order: oid(orderId) };
  if (packagePurchaseId) return { packagePurchase: oid(packagePurchaseId) };
  return { _id: null }; // matches nothing - a caller with no reference can't release anything
}

/**
 * Gives a redemption back: removes the usage entry that belongs to this appointment/order/purchase
 * and decrements the counter, in ONE atomic update. The filter requires the entry to still be there,
 * so calling it twice (double click, retry) releases once - the second call matches nothing and
 * returns null. After this the user is no longer in usageHistory, so maxUsesPerUser no longer
 * counts that use and they can order again with the same coupon.
 */
export async function releaseCoupon(couponId, ref, { session, reason = "auto", releasedBy = null, note = "" } = {}) {
  const match = usageRef(ref);
  // read the entry first so it can be copied into releaseHistory; the update below is still
  // conditional on the entry being present, so a concurrent release can't double-decrement
  const current = await Coupon.findOne({ _id: couponId, usageHistory: { $elemMatch: match } }, { "usageHistory.$": 1 })
    .session(session || null)
    .lean();
  const entry = current?.usageHistory?.[0];
  if (!entry) return null;
  return Coupon.findOneAndUpdate(
    { _id: couponId, usageHistory: { $elemMatch: match } },
    {
      $inc: { usedCount: -1 },
      $pull: { usageHistory: match },
      $push: {
        releaseHistory: {
          user: entry.user || null,
          appointment: entry.appointment || null,
          packagePurchase: entry.packagePurchase || null,
          order: entry.order || null,
          discountAmount: entry.discountAmount || 0,
          usedAt: entry.usedAt || null,
          releasedAt: new Date(),
          reason,
          releasedBy: releasedBy ? oid(releasedBy) : null,
          note: String(note || "").slice(0, 300),
        },
      },
    },
    { returnDocument: "after", session }
  ).lean();
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
  { userId, appointmentId = null, packagePurchaseId = null, orderId = null, discountAmount, onlyIfNotRecorded = false },
  { session } = {}
) {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }],
      // used when re-claiming a coupon for a reopened appointment/order: never add a second
      // usage entry for the same appointment/order (e.g. one cancelled before coupons were released)
      ...(onlyIfNotRecorded ? { usageHistory: { $not: { $elemMatch: usageRef({ appointmentId, packagePurchaseId, orderId }) } } } : {}),
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

export async function findCoupons({ search = "", limit = 20, page = 1, filters = {}, sort = { createdAt: -1, _id: -1 }, session } = {}) {
  const filter = buildCouponFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Coupon.find(filter)
      .sort(sort)
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

// idempotent: flags coupons that the wheel minted before Coupon.origin existed
export async function markCouponsAsWheel(ids = []) {
  if (!ids.length) return { modifiedCount: 0 };
  return Coupon.updateMany({ _id: { $in: ids }, origin: { $ne: "wheel" } }, { $set: { origin: "wheel" } });
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

// Called when a product Category is deleted - Coupon.productDiscount.excludedCategories
// is current targeting config, not a promise to anyone, same reasoning as
// pullProductFromAllCoupons above. Safe to auto-clean rather than block the delete.
export async function pullCategoryFromAllCoupons(categoryId, { session } = {}) {
  return Coupon.updateMany(
    { "productDiscount.excludedCategories": categoryId },
    { $pull: { "productDiscount.excludedCategories": categoryId } },
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
  findCouponUsageDetails,
  countCouponUsagesByUser,
  redeemCoupon,
  releaseCoupon,
  findCoupons,
  updateCouponById,
  deleteCouponById,
  countCoupons,
  markCouponsAsWheel,
  pullServiceFromAllCoupons,
  pullPackageFromAllCoupons,
  pullProductFromAllCoupons,
  pullCategoryFromAllCoupons,
  unsetPartnerFromAllCoupons,
};