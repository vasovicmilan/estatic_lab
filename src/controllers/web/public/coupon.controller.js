import couponService from "../../../services/coupon.service.js";
import { logInfo, logWarn } from "../../../utils/logger.util.js";
import { normalizeError } from "../../../utils/error.util.js";

function getAuth(req) {
  const isLoggedIn = !!req.session?.isLoggedIn;
  return { isLoggedIn, userId: isLoggedIn ? req.session.user.id : null };
}

/**
 * Core validate-and-store logic, usable both from the HTTP apply endpoint below
 * and from the cookie-based auto-apply on page load (see coupon-capture.middleware.js
 * and booking/shop controllers) - both need the exact same validation, just
 * triggered differently (an explicit click vs. a captured referral code).
 *
 * Never throws - callers get back { success, code, discountAmount } or
 * { success: false, message }, since an auto-apply failure should never surface
 * as an error to a visitor who didn't take any explicit action.
 */
export async function tryApplyCoupon(req, { code, context, serviceId, appointmentValue, productIds, orderValue } = {}) {
  try {
    if (!code) return { success: false, message: "Unesite kod kupona" };
    if (!["booking", "order"].includes(context)) return { success: false, message: "Nepoznat kontekst" };

    const { userId } = getAuth(req);
    let result;

    if (context === "booking") {
      result = await couponService.validateCouponForBooking(code, { userId, serviceId, appointmentValue: Number(appointmentValue) || 0 });
    } else {
      result = await couponService.validateCouponForOrder(code, {
        userId,
        productIds: Array.isArray(productIds) ? productIds : [productIds].filter(Boolean),
        orderValue: Number(orderValue) || 0,
      });
    }

    req.session.activeCoupon = {
      code: result.coupon.code,
      discountAmount: result.discountAmount,
      context,
      appliedAt: new Date().toISOString(),
    };

    logInfo(`[tryApplyCoupon] Kupon "${result.coupon.code}" primenjen`, { context, userId, discountAmount: result.discountAmount });
    return { success: true, code: result.coupon.code, discountAmount: result.discountAmount };
  } catch (error) {
    logWarn(`[tryApplyCoupon] Kupon nije primenjen: ${error.message}`, { code, context });
    const normalized = normalizeError(error);
    return { success: false, message: normalized.message };
  }
}

export async function applyCoupon(req, res) {
  const { code, context, serviceId, appointmentValue, productIds, orderValue } = req.body;
  const result = await tryApplyCoupon(req, { code, context, serviceId, appointmentValue, productIds, orderValue });
  return res.status(result.success ? 200 : 400).json(result);
}

export async function removeCoupon(req, res) {
  delete req.session.activeCoupon;
  return res.json({ success: true });
}