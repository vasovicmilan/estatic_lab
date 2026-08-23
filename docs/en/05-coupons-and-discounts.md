# Coupons & Discounts

## What a Coupon is

A **Coupon** is a discount code redeemable against a booking, a package purchase, or a shop order. It can discount either as a flat amount or as a percentage of the purchase, and can optionally be limited by:

- A date range it's valid within (or no expiry at all, for a code meant to run indefinitely).
- A maximum number of total uses, and/or a maximum number of uses per individual customer (either can be left unlimited).
- Which specific services, packages, or products it's allowed to apply to — or left unrestricted, valid against anything.

## Where a Coupon can be used

The same coupon system serves three different purchase contexts — a service booking, a package purchase, and a shop order. Bookings and package purchases share one common block of the coupon (discount type, value, restrictions) — consistent behavior no matter which of the two the coupon is applied to.

**Shop orders are handled separately.** The product catalog ranges from small consumables to devices worth several thousand euros, so the same percentage or flat amount rarely makes sense for both. A coupon therefore has a **separate, optional block dedicated exclusively to products** — its own discount type, value, and restrictions, entirely independent of the services/packages block. If that block isn't explicitly configured, the coupon **can't be redeemed at all** on a shop order, regardless of what the services/packages block says — a deliberately restrictive default, so a referral or promo code built for services never accidentally ends up applying to an expensive device.

Either block — services/packages or products — can optionally carry an **upper cap on the discount amount**, regardless of whether the discount is a percentage or a flat amount. This matters most for percentage discounts: a rate that's reasonable for a typical service can be disproportionately large once applied to an expensive item, and the cap acts as a safety net.

## Coupons and the referral program

A Coupon can optionally be linked to a specific **Partner**. This single distinction is what separates an ordinary promotional discount code (a seasonal sale code, a loyalty discount, and so on) from a genuine **referral code** that earns commission for the partner it belongs to when it's used. See `06-affiliate-partner-program.md` for the full referral and commission logic — this file only covers the discount mechanics themselves, which work identically whether or not a code happens to be tied to a partner.

## Welcome coupon

Every registration — password-based or Google — automatically triggers a welcome email carrying the code **DOBRODOSLI10** (10% off), valid for services and packages. The code is shared across every new user; protection against the same user redeeming it more than once relies on the coupon's existing `maxUsesPerUser` limit (default 1), not on minting a separate code per user.

The coupon is created lazily and idempotently on the very first registration ever (`coupon.service.js`'s `ensureWelcomeCoupon`) - there's no need to create it by hand in the admin panel. If it's ever deleted by mistake, the next registration recreates it with the same defaults (10%, no `productDiscount` block, so it never applies to shop orders).

The default settings (percentage, value, code) can be changed at any time directly from the admin panel (Marketing > Coupons) - once created, the coupon behaves like any other and is never overwritten by later calls to `ensureWelcomeCoupon`. The code itself is defined in `src/config/marketing.config.js` (`WELCOME_COUPON_CODE`, `WELCOME_COUPON_DISCOUNT_VALUE`) - if that code is ever changed there, the previously-created coupon under the old code stays in the database as an ordinary coupon and has to be manually deleted/deactivated.