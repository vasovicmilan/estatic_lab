import userService from "../services/user.service.js";
import couponService from "../services/coupon.service.js";
import emailService from "../services/email.service.js";
import { CART_REMINDER_STAGE1_HOURS, CART_REMINDER_STAGE2_HOURS, CART_DISCOUNT_COOLDOWN_DAYS } from "../config/cart-reminder.config.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as appointment-reminder-jobs.js/commission-jobs.js's runJob: do
// the work, log success, and on failure both log AND alert.
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Builds the same { stavke, ukupnaCena, ... } shape the cart page itself uses
// (see user.service.js's getCart / mapUserCart), rather than reading the raw
// `cart` array these queries already returned - a raw line only has
// {product, variant, quantity}, no resolved name/price, and re-resolving
// through getCart also means a since-deleted/deactivated product silently
// drops out of the email the same way it already does on the cart page,
// instead of the job crashing on a dangling reference.
async function resolveCartForEmail(userId) {
  return userService.getCart(userId);
}

/**
 * Plain "you left items in your cart" nudge, no discount - see
 * cart-reminder.config.js for the wait window. Only ever sent once per
 * abandonment episode (stage 0 -> 1); touching the cart again resets stage to
 * 0 (see user.repository.js's cart mutation functions), so this can fire
 * again on a later, separate abandonment.
 */
export async function runCartReminderStage1() {
  return runJob("cart-reminder-stage1", async () => {
    const users = await userService.findUsersDueForCartReminderStage1(hoursAgo(CART_REMINDER_STAGE1_HOURS));
    if (users.length === 0) return;

    let sent = 0;
    for (const user of users) {
      try {
        const cart = await resolveCartForEmail(user._id);
        if (cart.stavke.length === 0) continue; // every line dropped out (deleted/inactive products) - nothing to remind about
        await emailService.sendCartReminderEmail({ email: user.email, firstName: user.firstName }, cart);
        await userService.markCartReminderSent(user._id, 1);
        sent += 1;
      } catch (error) {
        logError(`[cron] cart-reminder-stage1 failed for user ${user._id}`, error, { userId: user._id });
      }
    }

    if (sent > 0) {
      logInfo(`[cron] cart-reminder-stage1: sent ${sent} of ${users.length} due reminder(s)`);
    }
  });
}

/**
 * Follow-up with the one-time discount coupon (see marketing.config.js's
 * CART_ABANDONMENT_COUPON_CODE) - only for people who already got the plain
 * stage-1 reminder and are STILL sitting on the same untouched cart.
 * CART_DISCOUNT_COOLDOWN_DAYS (via cartDiscountOfferedAt, which - unlike
 * cartReminderStage - does NOT reset when the cart is touched again) keeps a
 * repeat abandoner from getting a fresh discount offer every few days; the
 * coupon's own maxUsesPerUser separately stops them from actually redeeming
 * it more than once.
 */
export async function runCartReminderStage2() {
  return runJob("cart-reminder-stage2", async () => {
    const coupon = await couponService.ensureCartAbandonmentCoupon();
    const users = await userService.findUsersDueForCartReminderStage2(hoursAgo(CART_REMINDER_STAGE2_HOURS), daysAgo(CART_DISCOUNT_COOLDOWN_DAYS));
    if (users.length === 0) return;

    let sent = 0;
    for (const user of users) {
      try {
        const cart = await resolveCartForEmail(user._id);
        if (cart.stavke.length === 0) continue;
        await emailService.sendCartDiscountEmail({ email: user.email, firstName: user.firstName }, cart);
        await userService.markCartReminderSent(user._id, 2);
        sent += 1;
      } catch (error) {
        logError(`[cron] cart-reminder-stage2 failed for user ${user._id}`, error, { userId: user._id });
      }
    }

    if (sent > 0) {
      logInfo(`[cron] cart-reminder-stage2: sent ${sent} of ${users.length} due discount offer(s)`, { couponId: coupon._id });
    }
  });
}

export default { runCartReminderStage1, runCartReminderStage2 };
