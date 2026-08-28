# Admin Operations

This is a summary of what an administrator can see and manage across the platform. Individual areas are covered in more depth in their own files; this one is the map.

## Catalog management

Full control over what's offered and sold: services and their variants, multi-session packages and what they bundle, physical products and their variations, and the categories and tags used to organize all of it. The content side of the site — blog posts and general marketing content — is managed the same way.

## People management

Administrators manage every account type on the platform:

- **Users** — general customer accounts, including their status and role.
- **Employees** — staff profiles, their compensation setup, the services they're qualified for, their working hours, and (optionally) the calendar-sync configuration described in `11-external-integrations.md`.
- **Partners** — referral-program participants and their commission rate.

Promoting a user into an Employee or Partner profile is handled with the safeguard described in `01-users-roles-permissions.md`, so it never accidentally reduces someone's existing access.

## Bookings and orders

Administrators have full visibility into every appointment and every shop order, and can move either through its lifecycle on behalf of a customer or staff member when needed — confirming, completing, cancelling, reassigning to a different staff member, rescheduling to a new time, and so on, following the same rules described in `02-services-booking-appointments.md` and `04-shop-products-orders.md`.

An admin can also create an appointment directly from the admin panel (`/admin/termini/rucno-kreiranje`) instead of a customer booking it themselves — for walk-ins, giveaways, prizes, and similar cases. This can optionally set a hand-picked price for that one appointment instead of the service's catalog price - see `02-services-booking-appointments.md` for the full mechanics and why this is kept separate from the coupon system. Currently admin-only in practice - employees don't have access to the `/admin` panel at all (they have their own separate portal), though the service layer is already built to support them too if that's ever opened up.

## Package purchases

Since package purchases are recorded by an administrator rather than self-served by the customer (see `03-packages-and-purchases.md`), this is also where a package purchase actually gets created — selecting the customer, the package, and optionally applying a discount code, with the resulting price shown before the purchase is finalized.

## Marketing tools

Discount codes, referral-linked coupons, and the payout side of the partner program are all managed from the admin panel, alongside general marketing content like the newsletter and testimonials.

## Site content and settings

The admin panel (Content & Marketing > Site Content, `/admin/sajt`) edits everything in one singleton `SiteSettings` document, with no code change or redeploy needed:

- **Hero image** — the homepage's headline image. If it's never been set by hand, the code's default image is used instead.
- **Booking policy** — the gap between appointments, the slot grid step, the self-cancellation cutoff, the reschedule thresholds (see `02-services-booking-appointments.md`). Used to be hardcoded in `booking.config.js`, now admin-editable.
- **Currency** — code, display symbol, and symbol position. Only controls how a price is *displayed* (e.g. "2500 RSD" vs "€2500") - it doesn't change the underlying data or convert between currencies.

Changes here take effect immediately, without a server restart - the app keeps the current values in memory (`runtime-settings.cache.js`) and refreshes them the moment a change is saved.

This is deliberately separate from `business.config.js`, which stays a static, code-defined source of truth for the business's identity (name, address, hours...) — `SiteSettings` is editable content that changes without a deploy, and is meant to grow later (e.g. an "about us" page content block).

## Oversight and reporting

Administrators have access to operational reporting and an accountability trail covering actions taken across the platform — covered in full in `10-logs-and-audit-trail.md`. Separately, administrators also see the business numbers — bookings, sales, commissions, coupons — covered in `13-business-reports.md`.