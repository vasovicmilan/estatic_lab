import couponService from "../../../services/coupon.service.js";
import { logInfo, logWarn } from "../../../utils/logger.util.js";
import { normalizeError } from "../../../utils/error.util.js";

function getAuth(req) {
  const isLoggedIn = !!req.session?.isLoggedIn;
  return { isLoggedIn, userId: isLoggedIn ? req.session.user.id : null };
}

/**
 * Applies a coupon code for either a booking (appointment) or an order (checkout)
 * and, on success, stores it in session as the single active coupon for that
 * context. The final booking/checkout submission reads this from session rather
 * than trusting a resubmitted form field, so what actually gets redeemed is
 * exactly what the user saw previewed here - never a stale or unvalidated code.
 *
 * Re-validating here doesn't change the security story: bookAppointment/checkout
 * both re-validate the coupon again for real at submission time regardless (via
 * the same validateCouponFor* functions), so this is purely a UX preview step -
 * nothing is redeemed until the booking/order is actually created.
 */
export async function applyCoupon(req, res) {
  const { code, context, serviceId, appointmentValue, productIds, orderValue } = req.body;

  try {
    if (!code) return res.status(400).json({ success: false, message: "Unesite kod kupona" });
    if (!["booking", "order"].includes(context)) return res.status(400).json({ success: false, message: "Nepoznat kontekst" });

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

    logInfo(`[applyCoupon] Kupon "${result.coupon.code}" primenjen`, { context, userId, discountAmount: result.discountAmount });
    return res.json({ success: true, code: result.coupon.code, discountAmount: result.discountAmount });
  } catch (error) {
    logWarn(`[applyCoupon] Kupon nije primenjen: ${error.message}`, { code, context });
    const normalized = normalizeError(error);
    return res.status(normalized.statusCode || 400).json({ success: false, message: normalized.message });
  }
}

export async function removeCoupon(req, res) {
  delete req.session.activeCoupon;
  return res.json({ success: true });
}