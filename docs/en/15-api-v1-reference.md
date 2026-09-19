# API v1 Reference

The platform has two completely separate "faces": the server-rendered web app (EJS, sessions, CSRF - `/admin`, `/zakazivanje`, etc.) and a JSON API under `/api/v1`, meant for mobile apps, future external integrations, and white-label use of the platform as a backend for a different frontend. Both faces call the **same services** (`src/services/*`), so the business logic described elsewhere in this documentation applies identically regardless of which face a request goes through - this file only covers what's specific to the API layer: authentication, authorization, response shape, and the full route list.

## Authentication

The API uses **JWT (Bearer token)**, not sessions/cookies like the web side. Flow:

1. `POST /api/v1/auth/register` (register) or `POST /api/v1/auth/login` (login) with email/password returns a token in the response body.
2. Every following request sends that token in an `Authorization: Bearer <token>` header.
3. The token is valid for **24 hours** (`crypto.service.js`, `signJwt`), after which re-login is required - there is currently no refresh-token mechanism.
4. `GET /api/v1/auth/me` returns the currently-authenticated account's data (a useful "who am I" call for client apps rehydrating a saved token).

The token carries the user's role (`roleName`) and their **full permission list** (`permissions`) as of login time (the same pattern as the web session - see `01-users-roles-permissions.md`). Consequence: if an admin later edits or removes a permission from someone, **an already-issued token doesn't see that change** until it expires (up to 24h) or the user logs in again. For urgent access revocation (e.g. an employee let go), deactivating the account (`isActive: false`) is more reliable than editing the role alone, since that's checked on every request touching that account, not just at token issuance.

Without an `Authorization` header (or with an invalid/expired/forged token), every protected route returns `401` before touching the database.

## Authorization

Two layers, both applied as Express middleware before a request ever reaches a controller:

- **`apiAuthMiddleware`** - does a token even exist and is it valid. There's no "partial" access - a token is either valid or it isn't.
- **`requirePermission("some_permission")`** - does the decoded `permissions` array from the token contain that specific permission. Same permission list and meaning as the web side (`01-users-roles-permissions.md`) - the API doesn't introduce a parallel/different permission system.

Most `/admin/*` routes have **two levels**: the whole router requires at least `access_admin_panel` (a general "are you even allowed into the admin panel"), and each individual route on top of that requires its own specific permission (e.g. `manage_users`, `manage_payouts`). This is deliberate defense in depth - missing a specific check on one route still leaves the general check in place.

All `/admin/*` routes return `403` (not `404`) when the token is valid but the matching permission is missing - the distinction between "you don't exist" and "you're not allowed" is intentional, same as on the web side.

## Response shape

Every JSON response follows one consistent shape:

```json
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }

// error
{ "success": false, "error": { "id": "abc12345", "status": 400, "message": "...", "code": null } }
```

`meta` only appears on listing routes (pagination). `error.id` is the same ID written to `error.log` (see `10-logs-and-audit-trail.md`) - useful when reporting an issue, since it lets the exact server log line be found by ID instead of by timestamp.

Image/file upload fields (a post's cover image, a product's gallery, etc.) are **not supported through the JSON API** - creating/editing through `/api/v1/admin/*` always leaves the existing image untouched (or empty on create). Image upload still goes exclusively through the web `/admin` panel.

## Public routes (no token)

| Route | What it does |
|---|---|
| `GET /api/v1/catalog/services`, `/packages`, `/products`, `/team`, `/blog/posts`, `/business-partners` (+ `/:slug`) | The same public catalog as the web shop/services/blog, in JSON |
| `GET /api/v1/booking/:serviceSlug/slots` | Available appointment slots for a service (uses `optionalApiAuth` - works with or without a token) |
| `POST /api/v1/booking/confirm` | Book an appointment as a guest or a logged-in user |
| `POST /api/v1/auth/register`, `/login`, `/forgot-password`, `PUT /reset-password/:token`, `GET /verify/:token` | Standard auth flow |

## Logged-in-user routes (any role, just `apiAuthMiddleware`)

- **`/api/v1/me/*`** - the caller's own account: profile, password, account deletion, appointments, orders, addresses. No `requirePermission` check since it's always "mine", never someone else's.
- **`/api/v1/cart/*`** - cart and checkout (only the `/cart` and `/orders/checkout` branches require a token; the rest of `cart.routes.js` is public where it needs to be).

## Role-specific routes (a dedicated middleware, not `requirePermission`)

- **`/api/v1/employee/*`** - `employeeMiddleware`: must be logged in **and** have an employee profile. Own schedule, appointments, commissions, payouts.
- **`/api/v1/partner/*`** - `partnerMiddleware`: must be logged in **and** have a partner profile. Own commission, payouts, catalog for sharing a referral link.

## Admin routes (`/api/v1/admin/*`)

Each of these requires `apiAuthMiddleware` + `access_admin_panel`, plus the permission listed below. This mirrors the web `/admin` panel - same rules, same services, just JSON instead of EJS rendering.

### People (`admin-people.routes.js`)

| Method | Route | Permission |
|---|---|---|
| GET | `/users`, `/users/:userId` | `manage_users` |
| PUT | `/users/:userId`, `/status`, `/role`, `/verify`, `/anonymize` | `manage_users` |
| DELETE | `/users/:userId` | `manage_users` |
| GET/POST/PUT/DELETE | `/employees`, `/employees/:employeeId` (+ `/working-hours`) | `manage_employees` |
| GET/POST/PUT/DELETE | `/experts`, `/experts/:expertId` | `manage_employees` |
| GET/POST/PUT/DELETE | `/partners`, `/partners/:partnerId` | `manage_partners` |

### Taxonomy (`admin-taxonomy.routes.js`)

| Method | Route | Permission |
|---|---|---|
| GET/POST/PUT/DELETE | `/roles`, `/roles/:roleId` | `manage_roles` |
| GET/POST/PUT/DELETE | `/categories`, `/categories/:categoryId` | `manage_taxonomy` |
| GET/POST/PUT/DELETE | `/tags`, `/tags/:tagId` | `manage_taxonomy` |
| GET/POST/PUT/DELETE | `/resources`, `/resources/:resourceId` | `manage_resources` |

### Catalog (`admin-catalog.routes.js`)

| Method | Route | Permission |
|---|---|---|
| GET/POST/PUT/DELETE | `/services`, `/services/:serviceId` (+ `/seo`) | `manage_services` |
| GET/POST/PUT/DELETE | `/packages`, `/packages/:packageId` | `manage_packages` |
| GET/POST/PUT/DELETE | `/products`, `/products/:productId` (+ `/seo`) | `manage_products` |

### Package purchases (`admin-package-purchase.routes.js`, mounted at `/admin/package-purchases`)

Whole router behind `manage_packages` (no sub-permissions). `GET /`, `GET /:packagePurchaseId`, `POST /check-coupon` (discount preview only, before finalizing), `POST /`, `PUT /:packagePurchaseId` (+ `/cancel`), `DELETE /:packagePurchaseId`.

### Appointments (`admin-appointment.routes.js`)

Whole router behind `manage_appointments_all`. `GET /`, `GET /manual/check-package`, `POST /manual`, `GET /:appointmentId`, `PUT /:appointmentId/confirm|reject|cancel|complete|no-show|reopen|reassign|reschedule`, `DELETE /:appointmentId`.

### Orders (`admin-order.routes.js`)

Whole router behind `manage_orders`. `GET /orders`, `POST /orders/manual`, `GET /orders/:orderId`, `PUT /orders/:orderId/process|ship|deliver|complete|return|refund|cancel|reopen|contact`, plus `GET /temporary-orders`, `GET /temporary-orders/:orderId`, `PUT /temporary-orders/:orderId/confirm|shipping`.

### Marketing (`admin-marketing.routes.js`)

| Method | Route | Permission |
|---|---|---|
| GET/POST/PUT/DELETE | `/posts`, `/posts/:postId` (+ `/status`, `/seo`) | `manage_blog` |
| GET/POST/PUT/DELETE | `/coupons`, `/coupons/:couponId` | `manage_coupons` |
| GET/DELETE | `/newsletter-subscribers`, `/:subscriberId` | `manage_marketing` |
| GET/PUT/DELETE | `/testimonials`, `/:testimonialId` (+ `/approve`, `/reject`) | `manage_marketing` |
| GET/POST/PUT/DELETE | `/business-partners`, `/:partnerId` | `manage_marketing` |
| GET/PUT | `/contacts`, `/:contactId` (+ `/status`) | `manage_marketing` |
| GET/POST/PUT/DELETE | `/newsletter-campaigns`, `/:campaignId` (+ `/send`) | `manage_marketing` |

### Operations (`admin-ops.routes.js`)

| Method | Route | Permission |
|---|---|---|
| GET | `/dashboard` | just `access_admin_panel` |
| GET/POST/PUT | `/payout-requests` (+ `/direct`, `/:requestId/approve|pay|reject`) | `manage_payouts` |
| GET | `/audit-log` | `view_logs` |
| GET | `/logs`, `/logs/history`, `/logs/history/:date` | `view_logs` |
| GET | `/business-reports`, `/business-reports/history/...` | `view_business_reports` |
| GET/PUT | `/site-settings` | `manage_site_content` |
| GET/PUT | `/profile` | just `access_admin_panel` (always the caller's own admin profile) |

## What's NOT covered by the API yet

- **Image/file uploads** - see the note above; still exclusive to the web `/admin` panel.
- **Any web `/admin` sub-area not explicitly listed above** - if a new web-only admin screen is added, check whether it needs an API equivalent rather than assuming one already exists.

## Known limitations (deliberate trade-offs, not bugs)

- **Up to 24h stale permissions in the token** - see the Authentication section above.
- **No per-token/per-user rate limiting on `/api/v1/admin/*`** - the global rate limiter (`globalLimiter`) still applies by IP, but there's no additional admin-API-specific limit (unlike `loginLimiter`/`bookingLimiter`/`availabilityLimiter` on more sensitive public routes).
