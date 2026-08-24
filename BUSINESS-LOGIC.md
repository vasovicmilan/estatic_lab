# Estetik Lab: Business Logic, Start to Finish

This document systematically walks through every business domain of the platform: what the real business problem was, which approach was chosen (and why, including alternatives that were considered and rejected), and exactly how the solution was implemented. The goal is a reference you can come back to for any part of the system without having to reconstruct the reasoning from the code.

The order follows the natural flow of the business: first who's allowed to do what (users and roles), then what's sold and how (services, appointments, packages, the shop), then how that gets paid for and discounted (coupons), then who earns from it besides the business itself (partners, employees, payouts), then how the system connects to the outside world (Google Calendar, SrediMe) and communicates with people (notifications), and finally how all of it stays visible, secure, and verified (admin, logs, tests).

---

## 1. Users, Roles, and Permissions

**Business challenge.** The platform has several fundamentally different kinds of people using it: customers, therapists, partners who bring in customers, and the owner/administrator, each with different access rights. The system needed a solution that doesn't require writing new code every time a new combination of permissions comes up (e.g. a "shop manager" who can change prices but not approve payouts).

**Approach.** **Identity** (User: account, login, contact details) is separated from **profile** (Employee, Partner: specialized capabilities layered on top of the base identity) and from **Role** (which determines what a person is allowed to do). A role is defined as a list of granular **permissions** (e.g. `manage_coupons`, `manage_appointments_all`, `view_logs`), not as a fixed "user type" baked into the code.

**Why this approach.** The alternative, hardcoding "if (role === 'admin')" checks throughout the code, would mean every new permission combination (e.g. a role that can see finances but not touch the catalog) requires a code change in dozens of places. With granular permissions, a new role is just a new database row with the right permission list: zero code changes.

**How it was solved.**
- One person can be both an Employee and a Partner at the same time (e.g. a therapist who's also a partner). The system supports this without conflict because they're separate profiles, not mutually exclusive roles.
- Every role has a **priority** (Admin > Employee > Partner > User). When someone is promoted into an Employee or Partner profile, the system only changes their Role **if the new role outranks** the current one. This prevents promoting an admin into a partner (e.g. for testing the partner program) from accidentally **downgrading** their access: they keep the Admin role, with a Partner profile layered underneath it.
- Permissions are defined as a model-level enum (`PERMISSIONS` in `role.model.js`), the single source of truth used by both the access-check middleware and the role-editing admin form, so a nonexistent or mistyped permission can never accidentally be assigned.

---

## 2. Service Catalog and the Booking Process

**Business challenge.** The salon offers treatments that come in multiple variants (different durations, session counts, prices for essentially the same service). Booking has to prevent double-booking the same therapist at the same time, has to respect each therapist's real working hours, and has to leave room for prep and cleanup between appointments, while still letting the customer choose a specific therapist or "whoever's free."

**Approach.** Service → Variant (a specific combination of duration, price, and session count) → Appointment, with availability computed in real time from a therapist's working hours minus whatever's already booked (including appointments from the SrediMe marketplace, see section 11), with a built-in 30-minute buffer on both sides of every appointment.

**Why this approach.** The 30-minute buffer isn't an arbitrary number: it directly reflects a real need (setting up the space, the equipment, cleaning up) and is applied consistently everywhere availability is calculated, including external SrediMe appointments, so there's never a place where two appointments booked through different channels collide with no breathing room.

**How it was solved.**
- When a customer doesn't pick a specific therapist, the system re-checks who's actually free **at the moment the appointment is created** (not at the moment availability was displayed). This prevents two customers who both saw the same open slot from both succeeding at booking it (a race condition guarded by atomic MongoDB transactions with a `findOneAndUpdate` conditional filter, not a read-modify-save approach).
- If **exactly one** therapist is free, the system assigns them automatically (there's no real decision to defer). If **two or more** are free, the appointment is deliberately left unassigned: that's a genuine business decision, left to the administrator.
- **Payment** goes through one of two mutually exclusive paths: the variant's normal price (reduced by a coupon if one applies) or covered by an existing package (no new charge, since the cost was already covered when the package was purchased). An appointment paid from a package can't also carry a coupon, since there's no new charge for a coupon to discount.
- **Lifecycle**: Pending → Confirmed → Completed (or Rejected / Cancelled / No-show along the way). A customer can only cancel their own appointment up to 24h ahead (protects staff from last-minute cancellations); staff and admin can cancel without that restriction.
- **Reassignment** (changing *who* performs the appointment) and **rescheduling** (changing *when*) are deliberately separate actions with different permissions. Rescheduling follows a tiered rule based on how much time is left before the appointment:

| Time until appointment | Allowed |
|---|---|
| 24h+ | Any future day/time |
| 4-24h | Only a different time on the *same* day |
| <4h | Not allowed (except for an administrator) |

- **Capacity-limited resources** (e.g. an ESMA device, a table) are modeled as a distinct concept: every resource has a `capacity` (how many simultaneous appointments it supports), and an inactive resource is treated as zero capacity everywhere availability is computed, in one place (`resource.service.js`), so a service that depends on a resource automatically becomes unbookable the moment that resource goes offline.

> The numbers quoted in this section (30-minute buffer, 24-hour cancellation cutoff, etc.) are **defaults**. An admin can change any of them at any time through `/admin/sajt` (Booking Policy), with no code change or server restart. See section 13.

---

## 3. Staff-Created Appointments

**Business challenge.** Not every appointment comes from a customer booking themselves: walk-in customers, giveaway winners, gifts. These appointments often carry a price different from the catalog (e.g. free for a giveaway winner), and the existing coupon system isn't a natural fit.

**Approach and why.** Two approaches for a "special price" were considered: (1) through the coupon system, (2) a direct manual price entry, available to staff only. The second was chosen, for two reasons. Mathematically: a coupon discounts the catalog price by a percentage or fixed amount, it doesn't replace it outright, so it couldn't cleanly express e.g. "0 RSD." Security-wise: a coupon is a code that could theoretically be replayed or leaked, while a manual price never leaves the admin panel.

**How it was solved.**
- The new entry point (`/admin/termini/rucno-kreiranje`) uses **exactly the same transactional logic** as public booking (availability, resource, and overlap checking, automatic staff assignment): the logic isn't duplicated, the existing `bookAppointment` was simply extended with an optional `priceOverride` and `actorRole` parameter.
- `priceOverride` is only allowed when `actorRole` is "admin" or "employee" (checked at the service layer, not just the route, defense in depth), and it **excludes** coupons and package payment for that appointment.
- An appointment created this way is flagged (`manualBooking: true` in the database) for transparency and reporting, visible on the appointment's detail page.
- An administrator can pick an existing registered customer (their contact info is pulled from their account automatically) or enter a new customer's details (a guest account is created, same as public booking without an account).
- Unlike public booking, a past date is allowed here, for logging something that already happened after the fact.
- Currently admin-only in practice: employees don't have access to the `/admin` panel at all (they have their own separate portal), though the service layer is already built to support `actorRole: "employee"` too, if that's ever opened up.

---

## 4. Pre-Appointment Reminders

**Business challenge.** Forgotten appointments mean lost therapist time that can't be recovered. An automatic reminder was needed that doesn't depend on an administrator manually watching the calendar.

**Approach.** An email reminder **24h** and **4h** before the start, only for **confirmed** appointments (a pending appointment isn't settled yet, so it doesn't get a reminder).

**Why this approach.** Two ways of checking "is it time for a reminder" were considered: a tight time match against the cron job's own frequency (e.g. cron every 15 min, check "exactly within a 15-min window"), or a wide window with an independent "already sent" flag per appointment. The second was chosen, **more resilient to server downtime**. If the cron job misses a few cycles (restart, deploy), the next cycle catches up on any overdue reminders instead of permanently skipping them, because the guard field (`reminder24hSentAt` / `reminder4hSentAt`), not the tightness of the window, is what prevents duplicate sends.

**How it was solved.**
- The cron checks every 15 minutes (`src/jobs/appointment-reminder-jobs.js`), window configuration in one file (`src/config/reminder.config.js`). Adding a third window (e.g. 1h before) is one line of code, no change to the job's logic or schedule.
- The email content always shows the **exact date and time**, not a relative claim ("tomorrow," "in a few hours"): it stays accurate even if it ends up going out later than planned.

---

## 5. Multi-Session Packages

**Business challenge.** The standard wellness pricing model: a customer who pays upfront for multiple sessions gets a lower price per session. The problem: once a package is bought as a bundle (especially one mixing several different services), there's no direct answer to how much a single specific session is actually worth, and that answer is needed later for calculating employee commission (see section 9, where this is worked out in detail).

**Approach.** At the moment a package is purchased, the system **snapshots** (doesn't calculate later) the exact normal per-session price for every included service at that point in time. This snapshot is later the basis for a fair commission calculation, regardless of whether the service's price list changes afterward.

**Why this approach.** The alternative, calculating "session value" after the fact from the current price list, would be wrong if the price list changed in the meantime, and wouldn't have a clean answer for a package mixing multiple services. Snapshotting at purchase time makes this a time-stable record, independent of future price changes.

**How it was solved.**
- Since package purchases are paid outside the platform (in person, bank transfer), the **administrator** records the purchase once payment has been received, with the option to apply a coupon before finalizing.
- The system tracks, per service line item within the package: total purchased, used, and currently reserved (booked but not yet completed, given back if the appointment falls through).
- Cancelling a package purchase correctly reverses everything tied to it, including any already-approved partner commission (see section 8).

---

## 6. Shop, Products, and Orders

**Business challenge.** Besides services, physical products are also sold, ranging from small consumables to expensive equipment that can't be shipped through standard mail. A system was needed that works for both extremes without separate code for each.

**Approach.** Product → Variation (size or configuration, each with its own price and stock) → Cart → Order with a defined lifecycle, and an explicit split between **standard** shipping (flat, automatically calculated) and **freight** shipping (large or heavy items).

**Why this approach for shipping.** Automatically calculating freight shipping cost isn't possible without an actual arrangement with a courier, since the cost depends on the specific delivery. Rather than finalizing an order with an incorrect (or no) shipping cost, an order with at least one freight item goes to **awaiting a quote**: the administrator manually enters the real cost, and only then can the customer confirm the order via a link sent to their email.

**How it was solved.**
- Guests (not logged in) can complete a purchase and confirm the order via a secure email link, no account required.
- Lifecycle: Pending → Processing → Shipped → Delivered → **Completed** (final, no path back to cancellation, return, or refund from there). This finality directly determines the timing of partner commission (see section 8).
- Possible branches along the way: Cancelled (before shipping), Returned (after receipt), Refunded.
- Stock is decremented at the moment of payment (checkout), and restored automatically when an order is cancelled or returned (reserved quantities are released back to stock).
- Every product variation has its own low-stock threshold (`lowStockThreshold`, defaulting to 5), set per variation because a piece of equipment and a small consumable for it realistically need very different thresholds. Dropping below the threshold triggers a Telegram and email alert (see section 12).

---

## 7. Coupons and Discounts

**Business challenge.** The same discount-code system needs to serve three genuinely different purchase contexts (booking, package purchase, shop order), but the shop catalog ranges from small consumables to equipment worth several thousand euros, so the same percentage or flat discount rarely makes sense across all of them.

**Approach.** Booking and package purchase share **one common part** of a coupon (discount type, value, restrictions), consistent behavior regardless of which of the two you're using. Shop orders are deliberately **separate**: a coupon has a distinct, **optional** section dedicated exclusively to product items.

**Why this approach.** If that separate section for items isn't explicitly configured, the coupon **can't be used at all** on a shop order: a deliberately restrictive default. The alternative (a coupon automatically applies everywhere unless explicitly restricted) would mean a referral or promotional code made for services could accidentally become usable on an expensive piece of equipment, with a disproportionate discount. Both parts (services/packages and items) can carry an upper cap on the discount amount, important especially for a percentage discount, where a reasonable percentage for a typical service becomes a disproportionately large amount on an expensive item.

**How it was solved.**
- A coupon optionally carries restrictions: a validity period, a maximum number of total and/or per-customer uses (either of which can be left unlimited), and which specific services, packages, or products it covers.
- A coupon can optionally be linked to a specific Partner. That link is what separates an ordinary promotional code from a genuine referral code that earns a commission (see section 8). The discount mechanics are identical either way.

### The Welcome Coupon

**Business challenge.** New customers should get an incentive for their first purchase, automatically, with no manual admin work per registration.

**How it was solved.** On every registration (password or Google), a customer automatically gets an email with the code **DOBRODOSLI10** (10% off services and packages, not items). The code is **shared** across every new customer: protection against the same customer redeeming it more than once relies on the coupon's existing `maxUsesPerUser` limit (default 1), rather than generating a separate unique code per customer (simpler, fewer database records, same protection). The coupon is created automatically and lazily on the very first registration ever, self-correcting if it's ever deleted by mistake.

**A gap discovered and fixed during this work:** Google sign-in used to send **no email at all** (no confirmation, no coupon), since a Google email arrives already verified and the old logic read that as "nothing to send." Google customers now get a dedicated "welcome" email carrying the same coupon.

---

## 8. The Affiliate/Partner Program

**Business challenge.** Partners (external collaborators) bring in customers through their own links and should earn a commission on what those customers buy, but "buy" covers three fundamentally different kinds of transactions (booking, package purchase, order) with very different degrees of "is this actually final" at the moment of purchase.

**Approach, referral attribution.** A referral code in a URL (any page, not just the homepage) is remembered for a visitor for **30 days**, regardless of how many other pages they browse or whether they buy right away. The code is automatically applied as a discount at the moment of actual booking or payment: the customer doesn't have to remember or re-enter anything.

**Why this approach.** The 30-day window reflects real customer behavior (browse, leave, come back later). A shorter window would unfairly rob a partner of credit for a slow, but genuine, path to purchase.

**Exception, general contact inquiries.** A referral is attributed to a contact inquiry only when the visitor arrived at the contact page for a *specific* reason tied to that referral (e.g. a "contact us about this package" link). An unrelated, general inquiry carries no attribution: this protects against a partner getting credit for something unrelated to their referral.

**Approach, commission timing by purchase type.** Each of the three purchase types has a timing tailored to how genuinely **reversible** it is:

| Purchase type | When the commission becomes payable | Why |
|---|---|---|
| Booked appointment | As soon as the appointment is completed | Once the service has been delivered, nothing can undo it anymore |
| Shop order | Held for 2 weeks (the standard return window), then automatically payable, or immediately if the order reaches a final status before that | A return or cancellation in that window reverses the commission |
| Package purchase | Immediately | Paid and recorded outside the platform, nothing left to dispute |

**Why this approach.** If an order's commission became payable the instant it was purchased, returning an item a few days later would mean the partner had already "earned" money the business now has to claw back: more administratively complicated and riskier than waiting out the natural return window before paying out.

**How it was solved, further details.**
- An ordinary promotional code (with no partner tie) never generates a commission, no matter how it's used. Only a genuine referral code does.
- A partner has **two independent commission rates** (services/packages vs. items) plus an optional upper cap on commission per transaction, a last line of defense if a rate is mistakenly set too high for a particular case.
- A partner's dashboard: current balance and a quick payout request, a searchable history of every earned commission (filterable by status and type), a history of payout requests, and a "catalog" page that automatically appends their personal referral link to every service, package, and product, ready to copy.

### Buying a Package Through a Referral Code: How the Partner's Commission Actually Gets Calculated

This deserves a specific, precise explanation, since it's easy to assume the commission is calculated on the pre-discount price.

**A partner's commission is always calculated on the amount the customer actually paid, after the discount, never on the pre-discount price.** When a package is bought through a referral code that carries a discount, the system first applies the discount (e.g. 10% off from the coupon code) to the package's price, and only then applies the partner's commission rate to that **actually collected** amount. This is deliberate: a partner earns a percentage of what the business actually received, not a percentage of a price that was never charged. Had the commission been calculated on the pre-discount price, the business would end up paying the partner more than the commission rate was ever meant to represent, relative to actual revenue.

Implementation detail: `PackagePurchase.pricePaid` (the package's original price minus the coupon discount) is exactly that actually-collected value, and it's exactly the field the partner's commission rate is applied to (`commission.service.js`'s `recordPackagePurchaseCommission`). This has been verified and is correct.

A second question remains, though: when a commission-based employee later performs a session from that same package, what is *their* commission based on? This is worked out in full in the next section, since it deserves its own space: a genuine calculation bug was found and fixed there while writing this documentation.

---

## 9. Employee Compensation

**Business challenge.** A commission-based employee earns a percentage of what they perform, straightforward for a normally paid appointment. But what happens when they perform a session from an **already-purchased package**, where the customer isn't paying anything new at that moment? Neither "the full service price" nor "nothing" is the right answer.

**Approach.** A package-covered session is valued **at the same discount rate the customer actually got on the whole package**, applied to that specific service's normal (a la carte, as if bought individually) price.

**Why this approach.** The full a la carte price would pay the employee more than the business actually collected for that session (the customer got a discount, whether through the package itself, an additional referral code, or both). Zero would leave genuinely performed work uncompensated. The fair middle ground: the same percentage reduction the customer actually received, applied to that session's normal price.

### The bug that was found and fixed: the wrong reference value for the discount

The original implementation calculated the package's discount rate as `pricePaid / originalPrice`, where `pricePaid` is the amount actually collected, and `originalPrice` is a field that, unless the administrator enters a different value by hand, automatically gets set to the **package's own selling price** (`Package.totalPrice`), **not** the true a la carte value of everything included in the package (`Package.basePrice`, or more precisely, the sum of each individual line item's a la carte price).

The problem: `Package.totalPrice` is **already** a discounted bundle price. For example, in the real catalog, the package "Tesla-Tone 24, 5 treatments" has `totalPrice: 15750` and `basePrice: 17500` (17500 is the true a la carte value, 15750 is the package's price with roughly a 10% discount already built in).

When there's no coupon, `pricePaid` and `originalPrice` are the same number (both 15750), so the old formula produced a ratio of **1.0**, as if there had been no discount at all. A commission-based employee was, as a result, earning commission on the **full, undiscounted a la carte price** for every session from a package, completely ignoring the discount the package itself already carried. If a coupon had also been applied on top, the formula only caught that additional layer of discount, still ignoring the package's built-in one.

This meant a systematic overpayment to commission-based employees for every package-covered session, except in the rare case where a package carried no built-in discount at all relative to its a la carte value.

**The fix.** The discount rate is now calculated as `pricePaid / (the sum of a la carte prices for every line item in the package)`, where that sum is computed from the snapshotted `unitPrice` values per item (see section 5, where those `unitPrice` snapshots are taken at the moment of purchase). This corrected formula properly captures **both** layers of discount together: the package's own built-in discount, and any additional coupon discount, since both affect `pricePaid`, while the denominator remains, consistently, the true, undiscounted a la carte value.

### Worked examples with exact numbers

**Example 1, a package with no coupon.** A package of 5 sessions, each normally 3,000 RSD a la carte (15,000 RSD total), sold as a bundle for 12,000 RSD (a 20% built-in package discount), with no coupon at all. An employee on 10% commission performs one session:
- Discount rate = 12,000 / 15,000 = 0.8
- Commission base = 3,000 × 0.8 = 2,400 RSD
- Employee's commission = 2,400 × 10% = 240 RSD

**Example 2, the same package, but bought through a partner's referral code carrying an additional 10% off.**
- `originalPrice` (the package's selling price, before the coupon) = 12,000 RSD
- Coupon discount = 1,200 RSD (10% of 12,000)
- `pricePaid` (actually collected) = 10,800 RSD
- **Partner's commission** (section 8): calculated on `pricePaid` = 10,800 RSD, directly, at the partner's rate. This part has always been correct.
- **Employee's commission**: discount rate = 10,800 / 15,000 = 0.72 (the combined effect of the package's built-in discount *and* the coupon discount, not just one or the other)
  - Commission base = 3,000 × 0.72 = 2,160 RSD
  - Employee's commission (10%) = 216 RSD

This second example directly answers whether a referral discount factors into both the partner's and the employee's commission, and correctly: **yes, both**, but each in its own way. The partner earns on the actually-collected amount directly. The employee earns on their a la carte price reduced by the **total** actual discount (package plus coupon together), not just part of it.

This approach naturally works for packages that mix several different services too: each service's normal price determines its fair share of the total a la carte value, a more expensive included service is valued higher than a cheaper one, both reduced by the same overall discount rate.

Partner commission and employee commission on the same package stay completely independent of each other: the partner earns once, on the sale of the package itself; the employee earns separately, each time they actually perform one session from it. Neither reduces the other, both are calculated from the same underlying numbers (`pricePaid`, a la carte values), but each in the way appropriate to its own nature.

---

## 10. Payouts and Balances

**Business challenge.** Both partners and commission-based employees accumulate earnings that need to be tracked and paid out, with a clear answer at any moment to "how much can I actually withdraw right now."

**Approach.** A shared system for both kinds of earnings (partner and employee commission), based on three numbers calculated **from real, current data** at the moment of checking, not as a running total that could drift out of sync:

- **Earned**: total accumulated commission.
- **Paid**: total actually paid out.
- **Reserved**: commission approved but still within its review period (e.g. an order's return window, see section 8).
- **Available** = Earned − Paid − Reserved.

**Why this approach.** Calculating from real data, rather than maintaining a separate "current balance" field updated on every transaction, eliminates an entire class of bugs where a balance could drift out of sync with the actual records because of a missed update somewhere in the code.

**How it was solved.**
- An earner can request a payout for any amount up to what's currently available. The system rejects a request for more.
- The administrator handling the request can: **approve** it (accepted, in progress), **mark it paid**, or **reject** it with a reason visible to the earner.
- Separately, an administrator can **record a payout directly**, without waiting for a request, for cases outside the normal flow (e.g. cash handed over in person).
- The earner gets an email notification the moment a payout's status changes, including the reason if it was rejected. They're never left wondering.

---

## 11. External Integrations: Google Calendar and SrediMe

**Business challenge.** The business sells services both through its own site and through **SrediMe** (an external beauty-industry booking marketplace). Without coordination, the same slot could be booked on both at once for the same therapist, with neither system aware of the other.

**Approach.** Instead of a direct integration with SrediMe's own systems, both flow through **Google Calendar** as a shared, neutral point: one calendar per employee. The two sync directions work through **different mechanisms**, since SrediMe's own integration is explicitly one-way (it reads external calendars, it doesn't write to them).

**Why this approach.** A direct integration with SrediMe's API would require their cooperation and maintaining a dedicated connection. Google Calendar as a middleman is something SrediMe already supports natively (calendar import), so no coordination with SrediMe's side is needed at all, just entering the generated iCal link into SrediMe's settings once.

**How it was solved.**

**Direction 1 (platform → Google Calendar → SrediMe):** Every appointment assigned to an employee with a configured Google Calendar ID is automatically written as an event and updated as the appointment's status changes: created on assignment, moved when the time changes, deleted and recreated on a different calendar on reassignment (an event can't be "transferred," only recreated), deleted on cancellation or rejection (a calendar facing outward shouldn't show a booking that didn't go through), left untouched on completion or no-show (a historical record, always in the past, no risk of duplication). The event lasts 30 minutes longer than the appointment's actual end, the same buffer the system already uses internally. SrediMe then reads directly from that calendar via the iCal link, entirely on their side, with no further involvement from the platform. If an employee has no calendar configured, or the service is unavailable, none of this blocks the appointment itself: syncing is a side effect, never a prerequisite.

**Direction 2 (SrediMe → platform):** Every employee can have their own **SrediMe ICS URL** (a link SrediMe generates to export their bookings). A cron job checks that feed **every 15 minutes** and caches whatever appointments it finds as "busy" blocks, matched against previous checks (a reschedule updates the existing entry), automatically removed when a booking disappears from the feed (a cancellation on SrediMe's side). These cached blocks are treated **exactly the same** as the platform's own appointments in two places: when showing available slots to a customer, and again as a final check **at the moment** of actually confirming a new booking (since the view the customer saw could be a few minutes stale).

A known, narrow limitation: when reassigning or rescheduling an **existing** appointment, the employee dropdown filters against the same SrediMe blocks, but the write itself for those two actions doesn't re-check them the same way a fresh booking does. Worth closing in the future.

Periodic checking (instead of an instant notification from SrediMe) is a deliberate tradeoff: a much simpler and more resilient implementation, at the cost of a window of up to 15 minutes of delay.

---

## 12. Notifications: Email and Telegram

**Business challenge.** Customers, staff, and the administrator need to know when something important happens, without anyone having to manually check the state of the system.

**Approach.** Two channels for two different audiences: **email** for all transactional and personal notifications (customer, employee, partner), **Telegram** for real-time operational alerts to the administrator (a new sale, an error, low stock).

**How it was solved, email notifications to customer/employee/partner:**
- Account: registration confirmation (with the welcome coupon), welcome email for Google sign-in (with the coupon), guest account claiming, password reset, password change, account deactivation.
- Appointments: received, confirmed, cancelled, **reminder** (24h/4h), status change, reassignment to a different employee (notifies the new therapist).
- Orders: confirmation request (guest), received, status change (including shipped, delivered).
- Packages: purchase created, purchase cancelled.
- Payouts: request status change (partner and employee).
- Newsletter: subscription welcome, campaigns to subscribers.

**How it was solved, email notifications to the administrator:** new appointment, cancelled appointment, with a direct link to the details in the admin panel, and a subject line prefixed by category (e.g. "[TERMIN] ...") for easy inbox filtering and searching.

**How it was solved, Telegram operational alerts:** new appointment, cancelled appointment, appointment status change, reassignment, new order, cancelled order, order status change, **low stock** (per a threshold specific to each product variation), new contact inquiry, new testimonial, new customer, new package purchase, plus a separate channel for **error alerts** (system exceptions with throttling against spamming the same error).

**Why a separate Telegram channel for errors.** Operational notifications (a new appointment) and error alerts have different urgency and demand different attention from their audience. The administrator needs to see an error right away, but shouldn't have their workflow interrupted for every routine sale. Throttling on error alerts prevents one recurring error (e.g. an external service going down) from flooding Telegram with identical messages every second.

---

## 13. Site Content and Settings

**Business challenge.** The homepage's headline image (hero), the booking rules, and the currency were hardcoded in the code: every change required a code change and a redeploy, even though these are content and business decisions, not technical ones.

**Approach.** A new, dedicated, admin-editable `SiteSettings` model (a singleton document), deliberately **separate** from `business.config.js`, which stays a static, code-defined source of truth for the business's identity (name, address, hours).

**Why this approach.** `business.config.js` is deliberately static, since a change to the business's identity (address, name) is rare and, by nature, closer to code and deployment. The hero image, booking policy, and currency, on the other hand, are content and business decisions that genuinely change without any technical intervention, and by an administrator with no technical background.

**How it was solved.** An admin form (`/admin/sajt`) edits everything in one document, with no server restart:
- **Hero image**: the homepage's headline image, with an upload flow using the same mechanism as the rest of the catalog. If it's never been set by hand, the code's default image is used instead.
- **Booking policy**: the gap between appointments, the slot grid step, the self-cancellation cutoff, the reschedule thresholds (see section 2). Used to be hardcoded, now admin-editable.
- **Currency**: code, display symbol, and symbol position. Only controls how a price is displayed (e.g. "2500 RSD" vs. "€2500"); it doesn't change the underlying data or convert between currencies.

Changes take effect immediately. The system keeps the current values in memory (`runtime-settings.cache.js`) and refreshes them the moment a change is saved, instead of reading the database on every single request.

Built to grow later (e.g. an "about us" page's content) without needing a new model.

---

## 14. Admin Operations, Logs, and Audit

**Business challenge.** The administrator needs full operational control, but also a reliable answer to questions like who changed this price and when, whether the site ran normally today, or whether a given action actually succeeded, without relying on memory or informal notes.

**Approach, two separate kinds of record-keeping, for two different kinds of questions:**

**Operational reporting**: how the site itself is *functioning* (traffic, the rate of successful vs. failed requests, response speed). Two forms: a live view for the current day, and a searchable historical archive of past days for comparing periods and spotting patterns.

**Accountability trail (audit log)**: which *business* actions staff took (creating or editing a partner, adjusting an employee's compensation, approving or rejecting a payout, updating a price). For every logged action: who (and what role they had at that moment), when, **exactly what changed** (field by field, value before and after), from where (IP address, browser), and whether it succeeded (with a reason if it didn't).

**Why two separate records.** These are fundamentally different questions with different audiences: operational reporting is concerned with whether the site is working, the audit log is concerned with who did what and why. Mixing them into one system would make searching harder for both cases.

**Admin operations, overview.** Full control of the catalog (services/variants, packages, products/variations, categories/tags, blog), full management of people (customers, employees with compensation/services/hours/calendar, partners) with the promotion safeguard (see section 1), full visibility and control over appointments and orders (including manually creating an appointment, section 3), recording package purchases, marketing tools (coupons, referral links, payouts), and site content (section 13).

---

## 15. Security and Infrastructure

**Business challenge.** A production platform handling personal data and payments needs to be resilient against common attacks without relying solely on "security through obscurity."

**How it was solved** (a brief overview, not business logic in the strict sense, but directly protects the business):
- **UFW firewall** restricted to Cloudflare's IP ranges: the server isn't directly reachable outside of Cloudflare.
- **Cloudflare Authenticated Origin Pulls (mTLS)**: the server only accepts traffic that genuinely came through Cloudflare, not any request that merely claims to have.
- **A CSRF sync layer** on every state-changing form.
- **Telegram security alerts** with throttling against spam (see section 12).
- **The audit log** as described above: deters and uncovers misuse from the inside, not just attacks from the outside.

---

## 16. Testing

**Business challenge.** Business logic at this scale (commission calculation, coupon validation, status transitions, transactional protection against double-booking) has to stay correct through constant changes. A bug in the commission calculation directly means the wrong amount of money paid out, as section 9 just demonstrated with a concrete example.

**Approach, three separate layers, each checking a different thing:**

| Layer | What it checks | Tool |
|---|---|---|
| Unit | Individual service functions in isolation (database mocked) | Node's built-in test runner |
| Integration | Controller, validator, service, and repository together, for a given HTTP request | `supertest` + `mongodb-memory-server` |
| E2E | A real flow through a real browser and a real server | Playwright + Chromium |

**Why all three, not just one.** A unit test proves a commission calculation produces the right number. An integration test proves an HTTP request with bad data returns the right status code (not a 500 where a 400 belongs, or the reverse, a silently swallowed error). An E2E test proves a customer *can actually* complete a purchase start to finish through the real form, including things only a browser does (hidden fields, JS widgets, session cookies).

**Current state (latest run, fully green):**
- **2,222 of 2,222** unit and integration tests pass, with the most financially sensitive services (`commission.service.js`, `payout-request.service.js`, `resource.service.js`) at 100% line and function coverage.
- **23 of 23** E2E tests pass, one or more per key business flow start to finish: booking with commission, a coupon with a distinct discount for items, cancellation with stock restored, a full payout cycle, and so on.

---

## How the Pieces Fit Together: A Quick Dependency Overview

```
Users/Roles (1)
   |
   +--> Services/Booking (2) --> Staff-created appointments (3) --> Reminders (4)
   |         |
   |         +--> Packages (5)
   |
   +--> Shop/Orders (6)
   |
   +--> Coupons (7) <-- used in (2), (5), (6)
   |         |
   |         +--> Welcome coupon (subsection of 7)
   |
   +--> Affiliate program (8) <-- referral coupons from (7), purchases from (2)/(5)/(6)
   |
   +--> Employee compensation (9) <-- sessions from packages (5), discount from (7)/(8)
   |
   +--> Payouts (10) <-- shared by (8) and (9)

External integrations (11) <-- builds on the appointment lifecycle (2)
Notifications (12) <-- follow nearly every event from (2)-(10)
Site content (13), Admin/Logs (14), Security (15), Testing (16): run through all of the above
```

---

*This document reflects the state of the system through the shared history of work on the project. For technical details (file names, exact paths, code conventions), see `docs/en/`. This file deliberately stays at the level of business reasoning, not implementation. Serbian version: `POSLOVNA-LOGIKA.md`.*
