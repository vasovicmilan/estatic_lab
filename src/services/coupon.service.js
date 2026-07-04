import * as couponRepo from "../repositories/coupon.repository.js";
import { mapCouponsForAdminList, mapCouponForAdminDetail, mapCouponForEdit } from "../mappers/coupon.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

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
  if (!data.validUntil) validationError("validUntil");

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
 * Read-only validation used by appointment.service.js BEFORE it opens the booking
 * transaction. Returns { coupon, discountAmount } on success, throws AppError otherwise.
 * `userId` may be null (a brand-new guest hasn't been created yet at this point) — in
 * that case the per-user limit simply can't be checked yet and is skipped; it's re-verified
 * implicitly by `redeemCoupon`'s atomic push once the user does exist, so a determined
 * double-submit still can't bypass the global `maxUses` cap, only (in the rare
 * brand-new-guest edge case) the per-user cap on their very first booking.
 */
export async function validateCouponForBooking(code, { userId = null, serviceId, appointmentValue } = {}) {
  if (!code) validationError("code");

  const coupon = await couponRepo.findCouponByCode(code);
  if (!coupon) badRequest("Kupon ne postoji");
  if (!coupon.isActive) badRequest("Kupon nije aktivan");

  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) badRequest("Kupon još nije aktivan");
  if (coupon.validUntil && now > new Date(coupon.validUntil)) badRequest("Kupon je istekao");

  if (coupon.minAppointmentValue && appointmentValue < coupon.minAppointmentValue) {
    badRequest(`Kupon važi za termine u vrednosti od najmanje ${coupon.minAppointmentValue} RSD`);
  }

  if (coupon.applicableServices?.length && !coupon.applicableServices.some((s) => String(s) === String(serviceId))) {
    badRequest("Kupon ne važi za izabranu uslugu");
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    badRequest("Kupon je dostigao maksimalan broj upotreba");
  }

  if (userId && coupon.maxUsesPerUser != null) {
    const userUsageCount = await couponRepo.countCouponUsagesByUser(coupon._id, userId);
    if (userUsageCount >= coupon.maxUsesPerUser) {
      badRequest("Već ste iskoristili ovaj kupon maksimalan broj puta");
    }
  }

  const discountAmount =
    coupon.discountType === "percentage" ? Math.round((appointmentValue * coupon.discountValue) / 100) : coupon.discountValue;

  return { coupon, discountAmount: Math.min(discountAmount, appointmentValue) };
}

// atomic redemption — called from inside appointment.service.js's booking transaction
export async function redeemCoupon(couponId, { userId, appointmentId, discountAmount }, { session } = {}) {
  return couponRepo.redeemCoupon(couponId, { userId, appointmentId, discountAmount }, { session });
}

export default {
  listCoupons,
  getCouponById,
  getCouponForEdit,
  createCoupon,
  updateCouponById,
  deleteCouponById,
  validateCouponForBooking,
  redeemCoupon,
};
