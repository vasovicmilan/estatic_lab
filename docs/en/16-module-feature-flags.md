# Module Feature Flags (blog/shop/booking)

White-label clients don't always buy the whole system - some want only booking, some only the shop, some only the blog, or any combination. `ENABLED_MODULES` (in `.env`, see `.env.example`) decides which parts of the platform exist for a given deployment.

## Why an env var, not the admin panel

Deliberately a **deploy-time** decision (in `.env`), not something an admin edits live in the panel (unlike currency/booking policy/commission, which are DB-backed in `runtime-settings.cache.js`). Which modules exist is decided when a client's server is set up (see `DEPLOYMENT.md` - one `pm2` process per client), not something that changes day to day - turning booking off isn't a "preference", it changes what data and permissions even make sense.

## Three base modules, plus derived ones

```
ENABLED_MODULES=blog,shop,booking   # any combination, including just one
```

Every combination is valid, including all three or just one. An unrecognized value in the list crashes the server immediately at startup, with a clear error (`src/config/features.config.js`) - better to refuse to start than run quietly wrong.

Three **derived** flags aren't set directly, they're computed from the base three:

| Flag | On when | Why |
|---|---|---|
| `coupons` | `shop` OR `booking` | A coupon is meaningless without at least one channel to apply it to; it exists as soon as either does |
| `partners` (the affiliate/referral program, `/moj-partner-nalog`) | `shop` OR `booking` | A partner earns commission on orders and/or appointments - needs at least one to mean anything |
| `employees` (`/moj-nalog`) | `booking` | An employee fulfils appointments - there's no concept of staff without booking |

Packages (`/paketi`) relate exclusively to services (confirmed), so they're part of the `booking` module, no flag of their own.

**Important**: `/saradnici` (business-partner.controller.js - the "our collaborators/sponsors" marketing page) is **not** gated by any flag - it's general marketing content, a completely separate concept from the affiliate program above despite the similar name.

## How it's applied

Two forms, depending on whether a file serves one module or several:

- **Mount-level gating** - when the WHOLE file is single-purpose (e.g. `booking.routes.js`), `requireModule("booking")` goes right on `router.use("/booking", requireModule("booking"), bookingRoutes)` in `index.routes.js`. Simplest, most readable.
- **Per-route gating** - when a file mixes resources from more than one module in the same router (e.g. `admin-catalog.routes.js` serves both services/packages AND products), `requireModule(...)` goes on EACH route individually, the exact same way `requirePermission(...)` already goes per-route in those same files - no need to split the file, just add one more middleware next to the existing one on the same line.

**`src/middlewares/feature.middleware.js`** - `requireModule("shop")`; if the module is off, returns a plain **404** (not 403 - to a visitor, a disabled module simply doesn't exist on this deployment, same as a route that was never there).

**`src/config/locals.config.js`** - `res.locals.features` available in every EJS template globally (`<% if (features.shop) { %>...<% } %>`), for hiding nav/sections.

## What IS gated today

**Navigation and content** (`src/views/includes/navigation.ejs`, `home.ejs`):
- Public nav - links to Services/Packages (booking), Shop (shop), Blog (blog), Partner program (partners) are hidden; "Our team" stays always visible (Expert, deliberately independent)
- "Book an appointment" button → booking; cart icon → shop
- Account dropdown (desktop and mobile) - "My appointments" → booking; "My orders"/"My addresses"/"Cart" → shop
- Admin sidebar - data-driven (`adminNavGroups`), each item has an optional `feature` property; an item without one is always visible (general content - roles, categories/tags, users, experts, newsletter, etc.). An empty group (e.g. "Booking" when booking is off) doesn't render at all. "Payouts" is visible as soon as either employees or partners exist, since it covers commission for both
- Homepage (`index.service.js`'s `getLandingPageData()`) - a disabled module's data **isn't even queried** (not just hidden after fetching); `home.ejs` already checks `data.X.length > 0` per section, so an empty result automatically removes that section with zero template changes
- Footer (`footer.ejs`) - same module-specific links hidden as the header nav
- Sitemap (`sitemap.service.js`) - both the static landing-page entries (`/usluge`, `/prodavnica`, `/blog`) and the per-record entries (individual services/products/posts, plus their categories/tags) are skipped for a disabled module - this also covers a client who used to have a module enabled: leftover DB records from before don't leave dead, 404-ing sitemap entries behind
- `llms.txt` (`llms-txt.service.js`) - same idea as the sitemap; the whole "Prodavnica" section (not just its items) is skipped when `shop` is off, rather than left as an empty heading with a dead link
- Footer (`footer.ejs`) - same module-specific links hidden as the header nav
- Sitemap (`sitemap.service.js`) - both the static landing-page entries (`/usluge`, `/prodavnica`, `/blog`) and the per-record entries (individual services/products/posts, plus their categories/tags) are skipped for a disabled module - this also covers a client who used to have a module enabled: leftover DB records from before don't leave dead, 404-ing sitemap entries behind

Web side (`web.routes.js`), mount-level - each router is single-purpose:
- `/blog` → `blog`
- `/usluge`, `/paketi`, `/zakazivanje`, `/moj-nalog` → `booking` (`/moj-nalog` additionally via `employees`)
- `/prodavnica`, `/korpa` → `shop`
- `/kupon/*` → `coupons`
- `/moj-partner-nalog`, `/partnerski-program` → `partners`
- `/nas-tim` is **deliberately NOT gated** - it's Expert (the public "our team" showcase), deliberately independent of booking (see `expert.model.js`'s own comment: works with zero login accounts behind it)

API v1 (`index.routes.js`), mount-level where the file is already single-purpose:
- `/api/v1/booking` → `booking`
- `/api/v1/employee` → `employees`
- `/api/v1/partner` → `partners`
- `/api/v1/admin/appointments` → `booking`
- `/api/v1/admin/package-purchases` → `booking`
- `/api/v1/admin/orders`, `/api/v1/cart` → `shop`

API v1, **per-route** inside files that mix modules:
- `catalog.routes.js` (public) - `/services`, `/packages` → `booking`; `/products` → `shop`; `/blog/posts` → `blog`; `/team`, `/business-partners` NOT gated (Expert and business partners, both deliberately independent)
- `admin-catalog.routes.js` - services/packages → `booking`, products → `shop`
- `admin-marketing.routes.js` - posts → `blog`, coupons → `coupons`; newsletter/testimonials/business-partners/contacts/campaigns NOT gated (general marketing content, not tied to any one module)
- `admin-taxonomy.routes.js` - resources → `booking`; roles/categories/tags NOT gated (roles always exist, categories/tags are polymorphic across domains)
- `admin-people.routes.js` - employees → `employees`, partners → `partners`; users and experts NOT gated (users are general, experts are deliberately independent of booking, same as `/nas-tim`)

## What is NOT gated - real, named work that remains

**Admin panel nav** - already gated, see above.

**Structured data / SEO metadata** - `organization.builder.js` (the site-wide JSON-LD injected on every page via `locals.config.js`'s `orgJsonLd`) hasn't been checked for module-specific schema.org fields (e.g. an `Offer`/`Product` block); worth a look if a disabled module's structured data is still being emitted.

**robots.txt** - not reviewed for module-specific `Disallow` rules; currently just has the general disallow list from earlier work (booking-flow state pages, admin, etc.), nothing module-aware yet.
