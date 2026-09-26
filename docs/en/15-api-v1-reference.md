# API v1 Reference

The platform has two completely separate "faces": the server-rendered web app (EJS, sessions, CSRF - `/admin`, `/zakazivanje`, etc.) and a JSON API under `/api/v1`, meant for mobile apps, future external integrations, and white-label use of the platform as a backend for a different frontend. Both faces call the **same services** (`src/services/*`), so the business logic described elsewhere in this documentation applies identically regardless of which face a request goes through - this file only covers what's specific to the API layer: authentication, authorization, response shape, and the full route list.

## Authentication

The API uses **JWT (Bearer token)**, not sessions/cookies like the web side. Flow:

1. `POST /api/v1/auth/register` (register) or `POST /api/v1/auth/login` (login) with email/password returns a token in the response body.
2. Every following request sends that token in an `Authorization: Bearer <token>` header.
3. The token is valid for **24 hours** (`crypto.service.js`, `signJwt`), after which re-login is required - there is currently no refresh-token mechanism.
4. `GET /api/v1/auth/me` returns the currently-authenticated account's data (a useful "who am I" call for client apps rehydrating a saved token).

The token carries the user's role (`roleName`) and their **full permission list** (`permissions`) as of login time (the same pattern as the web session - see `01-users-roles-permissions.md`). Consequence: if an admin later edits or removes a permission from someone, **an already-issued token doesn't see that change** until it expires (up to 24h) or the user logs in again. For urgent access revocation (e.g. an employee let go), deactivating the account (`isActive: false`) is more reliable than editing the role alone, since that's checked on every request touching that account, not just at token issuance.

Without an `Authorization` header (or with an invalid/expired/forged token), every protected route returns `401` before touching the database. Like every other error, it uses the standard error shape below.

## Authorization

Two layers, both applied as Express middleware before a request ever reaches a controller:

- **`apiAuthMiddleware`** - does a token even exist and is it valid. There's no "partial" access - a token is either valid or it isn't.
- **`requirePermission("some_permission")`** - does the decoded `permissions` array from the token contain that specific permission. Same permission list and meaning as the web side (`01-users-roles-permissions.md`) - the API doesn't introduce a parallel/different permission system.

`/admin/*` routes have **two independent levels**, mirroring the web `/admin` panel: one gate on the whole `/api/v1/admin` mount (`apiAuthMiddleware` + `adminMiddleware` in `routes/api/v1/index.routes.js`) requires a valid token **and** the general `access_admin_panel` permission ("are you even allowed into the admin panel"), and each individual route on top of that requires its own specific permission (e.g. `manage_users`, `manage_payouts`). This is deliberate defense in depth - forgetting the specific check on one route still leaves the general gate in place, and holding a specific permission without `access_admin_panel` gets you nowhere.

All `/admin/*` routes return `403` (not `404`) when the token is valid but the matching permission is missing - the distinction between "you don't exist" and "you're not allowed" is intentional, same as on the web side.

## Response shape

Every JSON response follows one consistent shape:

```json
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }

// error
{ "success": false, "error": { "id": "abc12345", "status": 400, "message": "...", "code": null } }
```

`meta` only appears on listing routes (pagination). `error.id` is the same ID that appears in the server log line for that error (`errorId` field and `[id]` in the message - see `10-logs-and-audit-trail.md`) and is also returned in the `X-Error-ID` response header - useful when reporting an issue, since it lets the exact server log line be found by ID instead of by timestamp. Note that routine client errors (4xx) are logged at `warn` level, so they end up in the general app log, not `error.log`; only unexpected errors and 5xx go to `error.log`. The few AJAX helpers the website itself uses (coupon preview on forms, package check on the manual-appointment form) answer errors in this same shape when the request sends `Accept: application/json`, which the site's own scripts do. Every response also carries an `X-Request-Id` header (a random UUID per request).

**Every** error goes through this one shape - including `401` (missing/invalid token), `403` (missing permission), `429` (rate limited), validation errors (`400`, with the field list in `error.details`) and upload errors. Controllers and middleware never answer with their own ad-hoc error body; they pass an error to the central error handler, which is what produces the `id`, the `X-Error-ID` header and the log line.

Image/file upload fields (a post's cover image, a product's gallery, etc.) are handled in **two steps** through the JSON API: first upload the file to `/api/v1/admin/uploads/...` (see "Uploads" below), then pass the returned object as the image/gallery/video field of the normal JSON create/update call. The create/update routes themselves do not accept file bodies.

## Links in emails and alerts

Emails and Telegram alerts contain links (verify account, reset password, confirm order, unsubscribe, "open this appointment in the admin panel"...). The same action can be started from the server-rendered website or through this API by a separate frontend, and the link has to open the face the person actually uses. All such links are built in one place, `src/utils/link.builder.js` (`buildLink(name, params)`), from a route table that holds the website path and the frontend path for each action.

Which face is used is decided automatically: every request under `/api/*` is marked as "frontend", every other request as "web" (`link-context.middleware.js`), and the mark follows the request into the services, event listeners and emails it triggers. Work with no request at all (cron reminders, scheduled campaigns) uses `LINKS_DEFAULT_TARGET` (`web` by default - set to `frontend` when the separate frontend takes over the public domain). Frontend links use `FRONTEND_URL` (falls back to `BASE_URL` when unset; local Angular dev: `http://localhost:4200`).

The frontend has to provide these routes for the token links (each reads its params from the URL and calls the matching API route):

| Frontend route | Calls |
|---|---|
| `/verifikacija/:token` | `GET /api/v1/auth/verify/:token` |
| `/resetovanje-lozinke/:token` and `/preuzmi-nalog/:token` (guest account claim - same flow) | `PUT /api/v1/auth/reset-password/:token` |
| `/newsletter/odjava/:token` | `POST /api/v1/newsletter/unsubscribe/:token` |
| `/korpa/potvrda/:orderId/:token` | `GET /api/v1/orders/:orderId/confirm/:token` |

Account, employee and admin links (`/moj-nalog/zakazivanja`, `/zaposleni-panel/termini`, `/admin/zakazivanja/:id`, `/admin/porudzbine/:id`, `/admin/prodavnica/:id`, `/admin/poruke/:id/pregled`) already exist in the Angular app. To add a new link, add one entry with both variants to `LINK_ROUTES`; a unit test checks that both variants take the same parameters.

## Public routes (no token)

| Route | What it does |
|---|---|
| `GET /api/v1/services`, `/packages`, `/products`, `/team`, `/blog/posts`, `/business-partners` (+ `/:slug`) | The same public catalog as the web shop/services/blog, in JSON |
| `GET /api/v1/booking/:serviceSlug/slots` | Available appointment slots for a service (uses `optionalApiAuth` - works with or without a token) |
| `POST /api/v1/booking/confirm` | Book an appointment as a guest or a logged-in user |
| `GET /api/v1/booking/referral-code` | The referral (partner) code already captured for this visitor, if any |
| `POST /api/v1/booking/coupon/check` | Preview a coupon's discount before confirming a booking (`optionalApiAuth` - a logged-in caller's per-user coupon limits are honored) |
| `POST /api/v1/contact`, `/newsletter-subscribe`, `/testimonials` | The public contact form, newsletter sign-up and testimonial submission, with the same honeypot and rate limits as their web equivalents |
| `GET /api/v1/orders/:orderId/confirm/:token` | Order confirmation via the link in the confirmation email (no login) |
| `POST /api/v1/newsletter/unsubscribe/:token` | Unsubscribe via the link in a newsletter email (POST on purpose: mail scanners that GET every link must not be able to unsubscribe someone) |
| `POST /api/v1/auth/register`, `/login`, `/forgot-password`, `PUT /reset-password/:token`, `GET /verify/:token` | Standard auth flow |

## Logged-in-user routes (any role, just `apiAuthMiddleware`)

- **`/api/v1/me/*`** - the caller's own account: profile, password, account deletion, appointments (incl. cancel and reschedule), orders (incl. cancel), addresses (incl. default address). No `requirePermission` check since it's always "mine", never someone else's.
- **`/api/v1/cart`, `/api/v1/cart/items`, `POST /api/v1/orders/checkout`** - cart and checkout; all of these require a token. The only public route in `cart.routes.js` is the emailed order-confirmation link listed above.

## Role-specific routes (a dedicated middleware, not `requirePermission`)

- **`/api/v1/employee/*`** - `employeeMiddleware`: must be logged in **and** have an employee profile. Own schedule, appointments, commissions, payouts.
- **`/api/v1/partner/*`** - `partnerMiddleware`: must be logged in **and** have a partner profile. Own commission, payouts, catalog for sharing a referral link.

## Admin routes (`/api/v1/admin/*`)

Each of these requires a valid token and `access_admin_panel` (the mount-level gate described under Authorization), plus the permission listed below. This mirrors the web `/admin` panel - same rules, same services, just JSON instead of EJS rendering.

Besides the routes listed, most resources also expose `GET /:id/edit` (the record prepared for an edit form - employees, experts, partners, categories, tags, resources, services, packages, products, coupons, business partners, newsletter campaigns).

Routes belonging to a module that is switched off for the deployment (`ENABLED_MODULES`) respond `404` - see `16-module-feature-flags.md` for which routes are gated.

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

### Uploads (`admin-uploads.routes.js`)

Requires the admin-mount gate (token + `access_admin_panel`) plus the same permission as the target entity's own create/update route (an upload is never a broader grant than editing that entity).

| Method | Route | Notes |
|---|---|---|
| POST | `/uploads/:type` | Single image; returns `{ img, imgThumb, imgMedium, imgOriginal, imgDesc }` |
| POST | `/uploads/:type/gallery` | Multiple images |
| POST | `/uploads/:type/video` | Video; returns `{ url, thumbnail, title }` |

`:type` is one of `services`, `packages`, `products`, `categories`, `posts`, `testimonials`, `experts`, `partners`, `business-partners`, `site` (permissions: `manage_services`, `manage_packages`, `manage_products`, `manage_taxonomy`, `manage_blog`, `manage_marketing`, `manage_employees`, `manage_partners`, `manage_marketing`, `manage_site_content`). Any other value is rejected with `400` before the file is processed. Types tied to a module (`services`/`packages` → booking, `products` → shop, `posts` → blog, `partners` → partners) are also gated by that module.

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

- **Any web `/admin` sub-area not explicitly listed above** - if a new web-only admin screen is added, check whether it needs an API equivalent rather than assuming one already exists.

## Known limitations (deliberate trade-offs, not bugs)

- **Up to 24h stale permissions in the token** - see the Authentication section above.
- **Rate limiting is per IP, not per token/user** - every `/api/v1` request goes through `apiLimiter` (120 requests/minute) on top of the app-wide `globalLimiter` (200/minute); `POST /auth/login` additionally has the stricter `apiAuthLimiter` (10 failed attempts per 15 minutes), and the public forms/booking routes have their own limiters. There is no additional admin-API-specific limit.
