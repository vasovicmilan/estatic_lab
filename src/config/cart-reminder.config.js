// Single source of truth for cart-reminder-jobs.js's timing - same reasoning
// as reminder.config.js for appointments: one place to tune without hunting
// through the job/scheduler.
export const CART_REMINDER_STAGE1_HOURS = 24; // plain "you left items" nudge, no discount
export const CART_REMINDER_STAGE2_HOURS = 72; // follow-up with the one-time discount coupon
// How long after offering the discount (cartDiscountOfferedAt) before this
// person could be offered it again on a LATER, separate abandoned cart - the
// coupon's own maxUsesPerUser already blocks actually redeeming it twice, this
// is purely about not repeatedly emailing the same offer to someone who keeps
// abandoning carts without ever using it.
export const CART_DISCOUNT_COOLDOWN_DAYS = 90;
