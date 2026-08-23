// Single source of truth for the auto-issued "welcome" coupon (see
// coupon.service.js's ensureWelcomeCoupon). Kept as named constants, not a
// hardcoded string sprinkled across the codebase, so the code/discount can be
// changed in one place if it's ever revisited - and so email templates and the
// service that creates the coupon can never drift out of sync with each other.
export const WELCOME_COUPON_CODE = "DOBRODOSLI10";
export const WELCOME_COUPON_DISCOUNT_VALUE = 10; // percent