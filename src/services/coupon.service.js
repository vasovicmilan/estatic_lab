import couponRepo from "../repositories/coupon.repository.js";
import { mapCouponsForAdminList, mapCouponForAdminDetail, mapCouponForEdit } from "../mappers/coupon.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { WELCOME_COUPON_CODE, WELCOME_COUPON_DISCOUNT_VALUE } from "../config/marketing.config.js";

export async function listCoupons({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await couponRepo.findCoupons({ search, limit, page, filters });
  return { data: mapCouponsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getCouponById(couponId) {
  if (!couponId) validationError("couponId");
  const coupon = await couponRepo.findCouponById(couponId);
  if (!coupon) notFound("Kupon");
  return mapCouponForAdminDetail(coupon);
}

export async function getCouponForEdit(couponId) {
  if (!couponId) validationError("couponId");
  const coupon = await couponRepo.findCouponById(couponId);
  if (!coupon) notFound("Kupon");
  return mapCouponForEdit(coupon);
}

export async function createCoupon(data) {
  if (!data) validationError("data");
  if (!data.code) validationError("code");
  if (!data.discountType) validationError("discountType");
  if (data.discountValue == null) validationError("discountValue");

  const existing = await couponRepo.findCouponByCode(data.code);
  if (existing) conflict("Kupon sa ovim kodom već postoji");

  const created = await couponRepo.createCoupon({ ...data, code: data.code.toUpperCase().trim() });
  logInfo("Coupon created", { couponId: created._id, code: created.code });
  return getCouponById(created._id);
}

export async function updateCouponById(couponId, data) {
  if (!couponId) validationError("couponId");
  const existing = await couponRepo.findCouponById(couponId);
  if (!existing) notFound("Kupon");

  if (data.code && data.code.toUpperCase() !== existing.code) {
    const conflicting = await couponRepo.findCouponByCode(data.code);
    if (conflicting) conflict("Kupon sa ovim kodom već postoji");
  }

  const updated = await couponRepo.updateCouponById(couponId, data.code ? { ...data, code: data.code.toUpperCase().trim() } : data);
  logInfo("Coupon updated", { couponId, updatedFields: Object.keys(data) });
  return getCouponById(updated._id);
}

export async function deleteCouponById(couponId) {
  if (!couponId) validationError("couponId");
  const existing = await couponRepo.findCouponById(couponId);
  if (!existing) notFound("Kupon");
  await couponRepo.deleteCouponById(couponId);
  logInfo("Coupon deleted", { couponId });
  return { success: true };
}

/**
 * Idempotently makes sure the shared "welcome" coupon (WELCOME_COUPON_CODE)
 * exists, creating it with sane defaults on first call and doing nothing on
 * every call after that. Called from email.listener.js right before a
 * registration welcome email goes out - lazily-on-first-use rather than a
 * seed script, so it self-heals if the coupon is ever deleted by mistake.
 *
 * One shared code for every new user, not a unique code minted per user: the
 * existing maxUsesPerUser (default 1, see coupon.model.js) already enforces
 * "once per person" at redemption time via usageHistory, which makes a
 * per-user code unnecessary - it would just be the same protection with more
 * documents to manage. Deliberately created with productDiscount left null
 * and applicableServices/applicablePackages left empty, so it applies to
 * every service/package but, per coupon.model.js's restrictive-by-default
 * rule, never to product orders - matching the "usluge i paketi" scope this
 * coupon is meant for. If that scope is ever wrong for an already-created
 * coupon, edit it directly in the admin panel (Marketing > Kuponi) - this
 * function only ever sets the initial defaults, it never overwrites an
 * existing coupon on later calls.
 */
export async function ensureWelcomeCoupon() {
  const existing = await couponRepo.findCouponByCode(WELCOME_COUPON_CODE);
  if (existing) return existing;

  const created = await couponRepo.createCoupon({
    code: WELCOME_COUPON_CODE,
    discountType: "percentage",
    discountValue: WELCOME_COUPON_DISCOUNT_VALUE,
    maxDiscountAmount: null,
    minValue: 0,
    maxUses: null,
    maxUsesPerUser: 1,
    applicableServices: [],
    applicablePackages: [],
    productDiscount: null,
    isActive: true,
  });
  logInfo("Welcome coupon auto-created on first use", { couponId: created._id, code: created.code });
  return created;
}

/**
 * Read-only validation shared by both redemption paths (appointment booking, package
 * purchase). Returns { coupon, discountAmount } on success, throws AppError otherwise.
 * `userId` may be null (a brand-new guest hasn't been created yet at this point) - in
 * that case the per-user limit simply can't be checked yet and is skipped; it's re-verified
 * implicitly by `redeemCoupon`'s atomic push once the user does exist, so a determined
 * double-submit still can't bypass the global `maxUses` cap, only (in the rare
 * brand-new-guest edge case) the per-user cap on their very first booking.
 */
/**
 * Read-only validation shared by both redemption paths (appointment booking, package
 * purchase). Returns { coupon, discountAmount } on success, throws AppError otherwise.
 * `userId` may be null (a brand-new guest hasn't been created yet at this point) - in
 * that case the per-user limit simply can't be checked yet and is skipped; it's re-verified
 * implicitly by `redeemCoupon`'s atomic push once the user does exist, so a determined
 * double-submit still can't bypass the global `maxUses` cap, only (in the rare
 * brand-new-guest edge case) the per-user cap on their very first booking.
 *
 * "order" (products/shop) is handled on a completely separate rule set from
 * "appointment"/"packagePurchase" (services/packages) - see coupon.model.js's
 * productDiscount block. A coupon with no productDiscount configured simply
 * cannot be redeemed for an order at all, regardless of what its main
 * discountType/discountValue says - there is no fallback to the services/
 * packages rules for a product purchase.
 */
async function validateCoupon(code, { userId = null, kind, targetId, value } = {}) {
  if (!code) validationError("code");

  const coupon = await couponRepo.findCouponByCode(code);
  if (!coupon) badRequest("Kupon ne postoji");
  if (!coupon.isActive) badRequest("Kupon nije aktivan");

  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) badRequest("Kupon još nije aktivan");
  if (coupon.validUntil && now > new Date(coupon.validUntil)) badRequest("Kupon je istekao");

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    badRequest("Kupon je dostigao maksimalan broj upotreba");
  }

  if (userId && coupon.maxUsesPerUser) {
    const userUsageCount = await couponRepo.countCouponUsagesByUser(coupon._id, userId);
    if (userUsageCount >= coupon.maxUsesPerUser) {
      badRequest("Već ste iskoristili ovaj kupon maksimalan broj puta");
    }
  }

  if (kind === "order") {
    return validateProductDiscount(coupon, { targetId, value });
  }
  return validateServiceOrPackageDiscount(coupon, { kind, targetId, value });
}

function computeDiscount(discountType, discountValue, maxDiscountAmount, value) {
  const discountAmount = discountType === "percentage" ? Math.round((value * discountValue) / 100) : discountValue;
  const capped = maxDiscountAmount != null ? Math.min(discountAmount, maxDiscountAmount) : discountAmount;
  return Math.min(capped, value);
}

function validateServiceOrPackageDiscount(coupon, { kind, targetId, value }) {
  if (coupon.minValue && value < coupon.minValue) {
    badRequest(`Kupon važi za iznos od najmanje ${coupon.minValue} RSD`);
  }

  if (kind === "appointment") {
    if (coupon.applicableServices?.length && !coupon.applicableServices.some((s) => String(s) === String(targetId))) {
      badRequest("Kupon ne važi za izabranu uslugu");
    }
  } else if (kind === "packagePurchase") {
    if (coupon.applicablePackages?.length && !coupon.applicablePackages.some((p) => String(p) === String(targetId))) {
      badRequest("Kupon ne važi za izabrani paket");
    }
  }

  const discountAmount = computeDiscount(coupon.discountType, coupon.discountValue, coupon.maxDiscountAmount, value);
  return { coupon, discountAmount };
}

function validateProductDiscount(coupon, { targetId, value }) {
  const productDiscount = coupon.productDiscount;
  if (!productDiscount) badRequest("Kupon ne važi za proizvode");

  if (productDiscount.minOrderValue && value < productDiscount.minOrderValue) {
    badRequest(`Kupon važi za porudžbine od najmanje ${productDiscount.minOrderValue} RSD`);
  }

  // targetId is an array of product ids for an order (multiple line items,
  // unlike appointment/packagePurchase which only ever have one target) - valid
  // if productDiscount has no restriction, or at least one item in the cart matches
  if (productDiscount.applicableProducts?.length) {
    const targetIds = Array.isArray(targetId) ? targetId : [targetId];
    const matches = targetIds.some((id) => productDiscount.applicableProducts.some((p) => String(p) === String(id)));
    if (!matches) badRequest("Kupon ne važi ni za jedan proizvod u porudžbini");
  }

  const discountAmount = computeDiscount(
    productDiscount.discountType,
    productDiscount.discountValue,
    productDiscount.maxDiscountAmount,
    value
  );
  return { coupon, discountAmount };
}

// unchanged external behavior/signature from before - every existing caller/test keeps working
export async function validateCouponForBooking(code, { userId = null, serviceId, appointmentValue } = {}) {
  return validateCoupon(code, { userId, kind: "appointment", targetId: serviceId, value: appointmentValue });
}

export async function validateCouponForPackagePurchase(code, { userId = null, packageId, purchaseValue } = {}) {
  return validateCoupon(code, { userId, kind: "packagePurchase", targetId: packageId, value: purchaseValue });
}

export async function validateCouponForOrder(code, { userId = null, productIds = [], orderValue } = {}) {
  return validateCoupon(code, { userId, kind: "order", targetId: productIds, value: orderValue });
}

// atomic redemption - called from inside appointment.service.js's booking transaction,
// package-purchase.service.js when a coupon discounts a package purchase, or
// order.service.js when a coupon discounts an order
export async function redeemCoupon(
  couponId,
  { userId, appointmentId = null, packagePurchaseId = null, orderId = null, discountAmount },
  { session } = {}
) {
  return couponRepo.redeemCoupon(couponId, { userId, appointmentId, packagePurchaseId, orderId, discountAmount }, { session });
}

/**
 * A partner's own referral coupon(s), in a clean minimal shape - not the
 * Serbian admin-display shape mapCouponsForAdminList produces (translated
 * strings, pre-formatted discount text), since the callers here need the raw
 * code for building URLs and raw discountType/discountValue for their own
 * formatting. Used by both the admin's partner detail page and the partner's
 * own dashboard/catalog, so neither has to import coupon.repository.js directly.
 */
export async function listCouponsForPartner(partnerId) {
  if (!partnerId) validationError("partnerId");
  const result = await couponRepo.findCoupons({ filters: { partner: partnerId }, limit: 20 });
  return result.data.map((c) => ({
    id: c._id.toString(),
    code: c.code,
    discountType: c.discountType,
    discountValue: c.discountValue,
    isActive: c.isActive,
  }));
}

export default {
  listCoupons,
  getCouponById,
  getCouponForEdit,
  createCoupon,
  updateCouponById,
  deleteCouponById,
  ensureWelcomeCoupon,
  validateCouponForBooking,
  validateCouponForPackagePurchase,
  validateCouponForOrder,
  redeemCoupon,
  listCouponsForPartner,
};