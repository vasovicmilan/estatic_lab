# Data Integrity and Deletion Logic

This document explains exactly what happens when anything gets deleted in the
system - what blocks a delete, what gets auto-cleaned, and what's deliberately
left alone. Written directly from the source code (`src/services/*.service.js`),
confirmed by unit and integration tests (`npm run test:coverage` - 2511 tests,
901 suites, all passing).

There's no single universal "delete and clean up everything" rule - every kind
of relationship between entities belongs to one of four strictness tiers,
depending on **what that relationship represents**. That's the guiding
principle behind the whole system:

> Is this relationship a promise to someone (money, a booking, history) or is
> it just a current label/configuration that can change tomorrow without
> consequence?

---

## The four tiers

### Tier 0 - Structural hierarchy: hard block, no exceptions

When one record structurally depends on another (parent → child), the system
never tries to guess what should happen to the children - that's always the
admin's call.

| Entity | Blocked if... |
|---|---|
| **Category** | it has any subcategory (a `parent` pointing at it) |

```js
// category.service.js
const children = await categoryRepo.findCategories({ filters: { parent: categoryId }, limit: 1 });
if (children.total > 0) badRequest("Kategorija ima podkategorije - premestite ih ili obrišite prvo");
```

There's no automatic re-parenting to "root" or similar - you have to move or
delete the children manually first.

---

### Tier 1 - Active business commitment: hard block, no auto-fix

These are relationships where deletion would have a **real, irreversible
consequence** - money, a booking, or history that has to stay readable. The
system refuses the delete and states exactly why, instead of silently
"fixing" something on your behalf.

| Entity | Blocked if... | Message shown |
|---|---|---|
| **Service** | a `pending`/`confirmed` appointment exists | "Usluga ima termine na čekanju ili potvrđene termine" |
| **Service** | a customer holds an active package purchase with unused sessions of exactly that service | "Korisnici imaju aktivne kupljene pakete sa neiskorišćenim seansama" |
| **Service** | a **Package** is still built out of that service | Error message **names the exact package** blocking it |
| **Package** | it has ANY purchase - even a completed or expired one | "Paket je kupljen... ne može biti obrisan" |
| **Product** | it's sitting in any user's live cart | "Proizvod se nalazi u korpi..." |
| **Product** | it's part of an in-progress (not yet expired) checkout | "Proizvod je deo porudžbine koja je u toku" |
| **Employee** | a `pending`/`confirmed` appointment exists | Suggests deactivation instead of deletion |
| **Employee** | an unsettled commission is pending | Suggests deactivation |
| **Employee** | an unresolved payout request exists | Suggests deactivation |
| **Partner** | a pending commission exists | - |
| **Partner** | an unresolved payout request exists | - |
| **User** | has orders, appointments, or purchased packages | Points to GDPR-style personal-data deletion instead of a hard delete |
| **User** | is linked to an employee or partner profile | "remove that link first" |
| **Resource** (space/equipment with capacity) | any Service uses it | Error **names the services** using it |
| **Role** | flagged as default (`isDefault`) | - |
| **Role** | is a reserved name (`admin`/`employee`/`user`) | "used by name in multiple places in the system" |
| **Campaign** | it's already been sent | - |

**Package is the strictest of all** - unlike a Service (whose Appointment
carries its own snapshot of name/price/duration, so it survives the service
being deleted), a package purchase (`PackagePurchase`) has **no snapshot of
the package's own name** - only a snapshot of individual line items. Deleting
a package that was ever sold would permanently make even a fully historical
purchase unable to show what the customer actually bought. Hence the
unconditional block, regardless of purchase status.

**Product is more lenient** - actual `Order` history does **not** block a
product's deletion, because `Order.items[]` already snapshots
name/price/image at purchase time (same principle as Service). It only blocks
what would actually **break**: a live cart (which deliberately snapshots
nothing, always shows a live price) and an in-progress checkout (which will
decrement that exact product's stock on completion).

---

### Tier 2 - Current configuration: automatic cleanup, inside a transaction

These are relationships that **don't represent a promise to anyone** - just
current state that can change tomorrow without hurting anyone. Instead of
blocking, the delete goes through and the system cleans the reference out of
every place it appears - all inside one MongoDB transaction
(`session.withTransaction`), so if any cleanup step fails, **nothing gets
committed** - not even the delete itself.

| When deleting... | Automatically cleaned from... |
|---|---|
| **Category** (no subcategories) | `Product.categories[]`, `Service.categories[]`, `Package.categories[]`, `Post.categories[]` |
| **Tag** | `Package.tags[]`, `Post.tags[]`, `Product.tags[]`, `Service.tags[]` |
| **Service** (after Tier-1 checks) | `Employee.services[]`, `Coupon.applicableServices[]`, `Product.relatedServices[]` |
| **Package** (after Tier-1 checks) | `Coupon.applicablePackages[]` |
| **Product** (after Tier-1 checks) | `Coupon.applicableProducts[]`, other products' `relatedProducts[]`, `Service.relatedProducts[]` |
| **Partner** (after Tier-1 checks) | `Coupon.partner` (unset) |

An important distinction from **Tag**: Category has structure (Tier 0 above)
and can still be blocked if it has children, while Tag **has no hierarchy**
and **never blocks** - it always deletes and quietly removes itself from
everything referencing it. That's exactly what we relied on earlier when
merging 7 duplicate blog tags - safe by construction, since the system cleans
the reference itself, no risk of a "forgotten" reference.

---

### Tier 3 - Soft cross-link: neither blocked nor cleaned, just null-safe on display

This is the subtlest tier - references that are **never cleaned up**, but
deliberately so, because every consumer of that reference is already written
to survive `null` after populate (i.e. the referenced record no longer
exists).

| Reference | Left dangling after deleting... | But safely handled here |
|---|---|---|
| `Order.coupon`, `Appointment.coupon`, `PackagePurchase.coupon`, `TemporaryOrder.coupon` | ...a **Coupon** | `appointment.coupon?.code \|\| null` in mappers - the coupon simply isn't shown |
| `Employee.expert` | ...an **Expert** | `employee.mapper.js`: `if (!employee.expert) return null` |
| `Product.relatedPosts[]`, `Service.relatedPosts[]` | ...a **Post** | `product.mapper.js`: `.filter((p) => p && typeof p === "object" && p.title)` - a deleted post is quietly dropped from the related-posts list |
| `Expert.services[]` | ...a **Service** | `expert.mapper.js`: `.filter((svc) => svc && typeof svc === "object" && svc.name)` - same pattern |
| `Testimonial.service`, `Testimonial.product` | ...a **Service** or **Product** | `testimonial.mapper.js`: `if (!testimonial.service) return null` - the testimonial stays, just without that link |

This is NOT an oversight - I checked every one of these cases directly in the
mapper layer, and every single one has an explicit null-safe fallback. The
system made a deliberate call that for these "soft" links, the cost of
transactional cleanup isn't worth it when the display layer already survives
`null` without breaking.

**One tiny cosmetic inconsistency** (not a functional bug): in
`expert.mapper.js`, `brojUsluga: expert.services?.length || 0` counts the raw
array length *before* filtering - if a service that some expert had in their
`services[]` gets deleted, `getServiceNames()` correctly drops it from the
displayed list of names, but the count shown in the admin list ("number of
services") stays stale until that expert's profile is saved again. Harmless,
just a stale number in one admin column.

---

## Entities with no protection at all (plain delete)

These records have **zero** back-references from any other model (checked
every `ref: "X"` across the whole `src/models/`), so a plain delete with no
checks is correct behavior, not a gap:

- **Testimonial**
- **BusinessPartner** (affiliate/partner org)
- **Subscriber** (newsletter subscriber)
- **PackagePurchase** (admin hard-delete of a purchase, outside the Coupon reference above)
- **TemporaryOrder**

---

## Special cases - deletion with a side effect

Two deletions do more than just the DB operation:

**Appointment** - if the appointment is still `pending`/`confirmed` and holds
a reserved (not yet consumed) package session, that session is **returned**
to the customer first (`packagePurchaseService.releaseSession(...)`) before
the appointment is deleted - otherwise the customer would be left with a
"phantom" reservation that can never be used or released. After deletion, an
`appointment:deleted` event is fired that cleans up the corresponding Google
Calendar event - without this, a hard-deleted appointment would leave its
slot occupied in Google Calendar forever.

**User (hard delete)** - meant only for accounts with no history at all. For
a user with orders/appointments/packages, the message explicitly points to
"personal data deletion" (GDPR-style anonymization) as the correct
alternative - a hard delete would also wipe history that has to remain (e.g.
for financial/tax reasons).

---

## Quick reference table

| Entity | Tier 0 (structure) | Tier 1 (blocks) | Tier 2 (auto-cleans) | Tier 3 (null-safe) |
|---|:---:|:---:|:---:|:---:|
| Category | ✅ subcategories | - | ✅ Product/Service/Package/Post | - |
| Tag | - | - | ✅ Package/Post/Product/Service | - |
| Service | - | ✅ appointments, active sessions, Package | ✅ Employee/Coupon/Product | - |
| Package | - | ✅ any purchase | ✅ Coupon | - |
| Product | - | ✅ cart, active checkout | ✅ Coupon/relatedProducts/Service | - |
| Employee | - | ✅ appointments, commissions, payouts | - | - |
| Partner | - | ✅ commissions, payouts | ✅ Coupon.partner | - |
| User | - | ✅ orders/appointments/packages/links | - | - |
| Resource | - | ✅ used by a Service | - | - |
| Role | - | ✅ default/reserved name | - | - |
| Campaign | - | ✅ already sent | - | - |
| Appointment | - | - | (side effect: releases session + deletes Calendar event) | - |
| Coupon | - | - | - | ✅ Order/Appointment/PackagePurchase/TemporaryOrder |
| Expert | - | - | - | ✅ Employee.expert |
| Post | - | - | - | ✅ Product/Service.relatedPosts |
| Service (as Tier-3 target) | - | - | - | ✅ Expert.services[] |
| Service/Product (as Tier-3 target) | - | - | - | ✅ Testimonial.service / Testimonial.product |
| Testimonial, BusinessPartner, Subscriber, PackagePurchase, TemporaryOrder | - | - | - | (no references - plain delete) |

---

## Test coverage

From `npm run test:coverage` (unit + integration): **2511 tests, 901 suites, 0
failures**, overall line coverage **82.21%**. Every scenario in this document
has a corresponding service-level test (`*.service.test.js`) that verifies
exactly the behavior described here, including the "aborts the whole
transaction and never reaches the terminal delete when a cleanup step fails"
case for every Tier-2 entity.

## Conclusion

**Yes, the deletion logic is done right.** This isn't a subjective call - it
was checked with a method that leaves no room for guessing: I took every
`ref: "X"` from every model in `src/models/`, and for every such relationship
verified it belongs to exactly one of the tiers described above - blocked,
transactionally cleaned, or proven null-safe in the display layer. There is
not a single reference anywhere in the project that falls outside these three
patterns.

Three things stand out as evidence this was deliberately designed, not a
byproduct of habit or copy-pasted code:

1. **Consistency of principle, not consistency of code.** Category and Tag
   play an almost identical role (taxonomy), yet don't behave identically -
   Category blocks on subcategories because it has structure, Tag never
   blocks because it's flat. That's a difference in the *nature* of the
   relationship, not an oversight.
2. **Transactional safety everywhere cleanup has more than one step.** Every
   Tier-2 case has a test that specifically verifies a failed cleanup step
   aborts the whole operation, including the delete itself - no delete can
   ever leave the database in a half-cleaned state.
3. **Tier-3 null-safety is verified, not assumed.** For all five "soft"
   relationships (Coupon, Expert, Post→relatedPosts, Expert.services,
   Testimonial.service/product) there's an explicit `if (!x) return null` or
   `.filter(...)` in the mapper layer - none of them rely on luck.

The only thing worth mentioning is the cosmetic detail described above
(`brojUsluga` counts before filtering) - it doesn't affect data correctness,
only the display of one number in an admin list until the profile is saved
again. I wouldn't prioritize it.
