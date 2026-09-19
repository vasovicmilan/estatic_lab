// Single source of truth for the auto-issued "welcome" coupon (see
// coupon.service.js's ensureWelcomeCoupon). Kept as named constants, not a
// hardcoded string sprinkled across the codebase, so the code/discount can be
// changed in one place if it's ever revisited - and so email templates and the
// service that creates the coupon can never drift out of sync with each other.
export const WELCOME_COUPON_CODE = "DOBRODOSLI10";
export const WELCOME_COUPON_DISCOUNT_VALUE = 10; // percent

// Auto-issued the same way as the welcome coupon above (see
// coupon.service.js's ensureCartAbandonmentCoupon), sent by
// cart-reminder-jobs.js's stage-2 email. One shared code, not a code minted
// per person - maxUsesPerUser (see coupon.model.js) already makes a per-user
// code unnecessary, same reasoning as the welcome coupon's own comment.
export const CART_ABANDONMENT_COUPON_CODE = "VRATISE10";
export const CART_ABANDONMENT_COUPON_DISCOUNT_VALUE = 10; // percent