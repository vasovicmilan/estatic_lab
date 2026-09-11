# Employee Compensation

## Two ways staff get paid

Every staff member is set up under one of two compensation models:

- **Salary** — a fixed arrangement, unaffected by anything in this document.
- **Commission** — earns a set percentage of the value of the services they personally perform.

## Commission on a normally-paid appointment

For a straightforward, normally-paid appointment, a commission-based staff member's earnings are simply their percentage applied to whatever the customer actually paid for that appointment (after any discount code, if one was used).

## The harder case: a session paid for through a Package

A customer who has already purchased a multi-session package pays nothing new at the moment they actually use one of those sessions — they paid for it upfront, potentially at a meaningfully discounted bulk rate. This creates a genuine question the business needs a real answer to: what should a commission-based staff member earn for performing that session, given there's no new payment at that moment to calculate a percentage of?

Neither of the two obvious answers is right. Paying the staff member based on the service's full normal price would pay them more than the business actually collected for that particular session, since the customer got a bulk discount. Paying them nothing at all, because there's no new charge, would mean genuinely completed work goes uncompensated.

### The approach: value the session fairly, at the same discount rate the customer got

The system resolves this by valuing a package-covered session the same way the *business* values it — at the service's normal price, discounted by the exact same overall rate the customer's package represents.

Concretely: when a package is purchased, the system already knows both the normal, undiscounted value of everything included in it, and what the customer actually paid overall. That comparison establishes the package's real discount rate. When a staff member later performs one specific session from that package, their commission is calculated on that session's normal price, adjusted by that same discount rate — not the full price, and not zero.

**A worked example:** a package covering 5 sessions of a treatment normally priced at 3,000 RSD each (15,000 RSD if bought individually) is sold as a bundle for 12,000 RSD — a 20% overall discount. A staff member on a 10% commission rate who performs one of those sessions earns commission on 3,000 × 0.8 = 2,400 RSD, i.e. 240 RSD — a fair share of what the business actually realized for that specific session, proportional to its normal value relative to every other service in the package.

This approach also naturally handles packages that bundle more than one type of service together, since each service's own normal price is what determines its fair share of the package's overall value — a more expensive included service is correctly valued higher than a cheaper one, both discounted at the same overall rate.

## Minimum guaranteed commission per session

On top of the proportional valuation described above, there's one safety net: a **minimum commission per session** (`minimumSessionCommission`, default 500 RSD). It's configurable by an admin at any time through `/admin/sajt` → the "Provizija" (Commission) section, no code change or server restart required - the same pattern as the other configurable values mentioned throughout this documentation.

### Why it exists

The proportional valuation is fair on average, but has a flaw at the extremes: if a package was sold at a very steep promotional price, or given away entirely (pricePaid: 0 RSD), a percentage of an almost-zero session value comes out to an almost-zero commission - even though the staff member performed exactly the same physical work as for a normally-paid session. The minimum commission guarantees a commission-based staff member never earns less than this amount for a performed session, in the precisely defined cases below.

### Where it applies, and where it deliberately doesn't

The minimum commission applies **exclusively** in two cases:

1. **A package-covered session** — any session where the appointment is tied to a purchased package (`appointment.packagePurchase` is set). If the proportionally-calculated commission comes out below the floor, the staff member gets the floor instead of the calculated value.
2. **A manually-created appointment with a manually-set price** — an appointment created through `/admin/termini/rucno-kreiranje` (see `02-services-booking-appointments.md`) where an admin/employee explicitly entered a price instead of the catalog one (a gift, a prize, an agreed walk-in price). Recognized by the `appointment.manualBooking` flag, which is set **only** when a manual price was actually used - not for every manually-created appointment in general. A manually-created appointment WITHOUT a manual price (e.g. an admin just booking a normal-catalog-price walk-in on the customer's behalf, or one paid from the customer's package with no manual price involved at all) carries the same ordinary risk of a low commission as any other normally-paid appointment, so this protection doesn't apply to it under this rule - unless, of course, it falls under case 1 because it's package-covered.

The minimum commission is **never** applied to an ordinary a-la-carte appointment, even with a discount code - no matter how small the calculated commission comes out, it stays exactly what the proportion dictates. A coupon discount is the customer's own legitimate choice, not an administrative decision to "give away" the service, so it doesn't carry the same protection.

### Example

Continuing the 5-session package example above (normal price 3,000 RSD per session, package sold for 12,000 RSD, i.e. a 20% discount): a staff member on a 10% commission rate earns 240 RSD per session from that package - above the 500 RSD floor, so the minimum has no effect.

Now imagine the same package, instead of the usual discount, was given away as a promotional gift for 0 RSD (e.g. a contest prize). The proportional commission would then come out to exactly 0 RSD (3,000 × 0% of the price paid = 0). The minimum commission guarantees the staff member still gets 500 RSD for that session - they performed the full treatment, the customer just paid nothing for that particular package.

The same applies to a manually-created appointment with no package involved: if an admin creates an appointment for a contest winner and manually sets the price to 0 RSD, the commission-based staff member still gets the 500 RSD minimum, not 0 - even though there's no package involved at all.

### Why the floor sometimes applies unevenly within the same package

Since a package can bundle several different services of different value (see the multi-service example in the previous section), and each service keeps its own proportional value, it's possible for some sessions within one and the same package to fall below the floor (and get bumped to it), while others stay above the floor (and get the exact calculated percentage, with no bonus on top). This isn't a bug, it's intended behavior: the cheaper service in the package is protected by the floor precisely because its proportional value can come out too small, while the more expensive service in the same package still fairly gets its own real, larger share - without either one being "averaged" against the other.

## Where commission fits alongside the referral program

This entire section is about what a staff member personally earns for performing a service. It's completely independent from partner referral commission (see `06-affiliate-partner-program.md`) — the two can both apply to the very same appointment without any conflict: a partner may have earned commission when the underlying package was originally purchased through their referral link, and separately, whichever staff member later performs a session from that package earns their own commission on the value of their own work.