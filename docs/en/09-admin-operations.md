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

The admin panel (Content & Marketing > Site Settings, `/admin/sajt`) edits everything in one singleton `SiteSettings` document, with no code change or redeploy needed:

- **Hero image** — the homepage's headline image. If it's never been set by hand, the code's default image is used instead.
- **Booking policy** — the gap between appointments, the slot grid step, the self-cancellation cutoff, the reschedule thresholds (see `02-services-booking-appointments.md`). Used to be hardcoded in `booking.config.js`, now admin-editable.
- **Currency** — code, display symbol, and symbol position. Only controls how a price is *displayed* (e.g. "2500 RSD" vs "€2500") - it doesn't change the underlying data or convert between currencies.

Changes here take effect immediately, without a server restart - the app keeps the current values in memory (`runtime-settings.cache.js`) and refreshes them the moment a change is saved.

This is deliberately separate from `business.config.js`, which stays a static, code-defined source of truth for the business's identity (name, address, hours...) — `SiteSettings` is editable content that changes without a deploy, and is meant to grow later (e.g. an "about us" page content block).

### Site texts

The texts on the public pages (Content & Marketing > Site Texts, `/admin/sajt/sadrzaj`) live in a second singleton document, `SiteContent`, and are edited in the regular web admin panel (the same data is still available through the API, `/api/v1/admin/site-content/*`). Each section has its own edit page:

- **About** (`/o-nama`), **Privacy Policy**, **Terms and Conditions** — an intro plus a list of sections; each section has a title, paragraphs, a list, closing paragraphs and optional sub-sections (one level). Paragraphs may contain HTML (e.g. a link).
- **FAQ** — questions and answers.
- **Partnership program** — intro, steps (the step number is assigned from the order) and highlights.
- **Home intro**, **Why us**, **Team page intro** — the texts and cards on the home page and the team page.
- **Home hero**, **Services / Packages / Blog page intro**, **Shop intro** (intro + trust cards + FAQ), **Contact page & location** (intro, address, Google Maps embed, Google sign-in notice) — previously hardcoded in presenters; now in the database and the public API (`GET /api/v1/home`, `/contact-page`, `/list-intro/:page`, `/testimonials`, `/blog/archive/:type/:slug`), so the EJS site and Angular show the same thing.
- **Page SEO** (`/admin/sajt/sadrzaj/seo-stranica`) — SEO title and description for all 13 static/listing pages (home, services, packages, shop, blog, team, partners, contact, About, FAQ, privacy, terms, partnership). The backend is the single source of truth: the EJS site and the public API `GET /api/v1/page-seo/:page` (title, description, canonical, robots, OG/Twitter, JSON-LD; home also carries Organization JSON-LD) read the same data, and the Angular frontend only applies it.

A change is visible on the site immediately, and every save is written to the audit log (`SITE_CONTENT_*_UPDATED`). Requires the `manage_site_content` permission.

### SEO keywords

Services, packages, products and blog posts have a dedicated SEO page (`/…/:id/seo`) for keywords; business partners have an SEO title, description and keywords directly in their edit form.

## Oversight and reporting

Administrators have access to operational reporting and an accountability trail covering actions taken across the platform — covered in full in `10-logs-and-audit-trail.md`. Separately, administrators also see the business numbers — bookings, sales, commissions, coupons — covered in `13-business-reports.md`.