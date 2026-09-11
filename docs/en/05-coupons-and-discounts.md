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

## Excluding an entire product category from a coupon

The discount cap above solves "the percentage is too high in absolute terms" for an expensive item, but not a different, more fundamental problem: some products (typically large/expensive devices) aren't sold off a fixed catalog discount at all - the price is negotiated individually, device by device. For those, capping the discount isn't enough - it needs to be **excluded entirely**.

Trying to solve this by manually enumerating products (a whitelist of `applicableProducts`, or the reverse - listing everything EXCEPT a handful) doesn't scale: the catalog grows, and every new expensive item would need every existing partner coupon manually updated to stay out of reach. So the product block has a dedicated mechanism for this instead:

- **`Excluded categories`** — an admin marks a whole category (e.g. "Aparati i oprema" / Devices & equipment) as excluded, once, on the coupon itself. Every product currently in that category, or any of its subcategories, is automatically out of reach for this coupon - and, crucially, **every future product** added to that (sub)category is excluded too, automatically, with no further edit to this or any other coupon required.
- **Exclusion always wins.** Even if a product from an excluded category happens to also be individually listed on the whitelist (`applicableProducts`), the category exclusion still decides - there's no guessing about which rule "wins", exclusion is an absolute veto.
- **An order with a mixed cart is rejected outright.** If the cart contains both a covered item and an item from an excluded category, the coupon doesn't apply to that order at all (not partially, on just the "allowed" portion) - the error naming the **specific category** at fault (e.g. "This code doesn't apply to the following items in your cart (category: Aparati i oprema)"), instead of a generic "invalid code" that would leave the customer guessing why. The customer then either removes that item from the cart, or orders it separately without the code.

This mechanism is independent of the discount cap above - they can be combined (a coupon that caps cheaper items and entirely excludes a device category) or used on their own.

## Coupons and the referral program

A Coupon can optionally be linked to a specific **Partner**. This single distinction is what separates an ordinary promotional discount code (a seasonal sale code, a loyalty discount, and so on) from a genuine **referral code** that earns commission for the partner it belongs to when it's used. See `06-affiliate-partner-program.md` for the full referral and commission logic — this file only covers the discount mechanics themselves, which work identically whether or not a code happens to be tied to a partner.

## Welcome coupon

Every registration — password-based or Google — automatically triggers a welcome email carrying the code **DOBRODOSLI10** (10% off), valid for services and packages. The code is shared across every new user; protection against the same user redeeming it more than once relies on the coupon's existing `maxUsesPerUser` limit (default 1), not on minting a separate code per user.

The coupon is created lazily and idempotently on the very first registration ever (`coupon.service.js`'s `ensureWelcomeCoupon`) - there's no need to create it by hand in the admin panel. If it's ever deleted by mistake, the next registration recreates it with the same defaults (10%, no `productDiscount` block, so it never applies to shop orders).

The default settings (percentage, value, code) can be changed at any time directly from the admin panel (Marketing > Coupons) - once created, the coupon behaves like any other and is never overwritten by later calls to `ensureWelcomeCoupon`. The code itself is defined in `src/config/marketing.config.js` (`WELCOME_COUPON_CODE`, `WELCOME_COUPON_DISCOUNT_VALUE`) - if that code is ever changed there, the previously-created coupon under the old code stays in the database as an ordinary coupon and has to be manually deleted/deactivated.