# Coupons & Discounts

## What a Coupon is

A **Coupon** is a discount code redeemable against a booking, a package purchase, or a shop order. It can discount either as a flat amount or as a percentage of the purchase, and can optionally be limited by:

- A date range it's valid within (or no expiry at all, for a code meant to run indefinitely).
- A maximum number of total uses, and/or a maximum number of uses per individual customer (either can be left unlimited).
- Which specific services, packages, or products it's allowed to apply to — or left unrestricted, valid against anything.

## Where a Coupon can be used

The same coupon system serves three different purchase contexts — a service booking, a package purchase, and a shop order — through one shared set of validation rules, so a code behaves consistently no matter where it's redeemed: is it currently active, does it apply to what's being purchased, and has it (or has this specific customer) already used up its allowance.

## Coupons and the referral program

A Coupon can optionally be linked to a specific **Partner**. This single distinction is what separates an ordinary promotional discount code (a seasonal sale code, a loyalty discount, and so on) from a genuine **referral code** that earns commission for the partner it belongs to when it's used. See `06-affiliate-partner-program.md` for the full referral and commission logic — this file only covers the discount mechanics themselves, which work identically whether or not a code happens to be tied to a partner.
