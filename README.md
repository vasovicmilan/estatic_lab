# Estatic Lab

Wellness studio booking and e-commerce platform — appointments, multi-session packages, shop orders, a full partner/affiliate referral program, and two-way calendar sync with Google Calendar and the SrediMe booking marketplace — built on Node.js/Express, MongoDB, and EJS.

**Live site:** [beautymedica.rs](https://beautymedica.rs)

## Documentation

Full business-logic documentation is available in two languages. Each set covers the same ground, in the same order, so you can cross-reference between them by file name.

- 🇬🇧 **English** — [`docs/en/00-INDEX.md`](docs/en/00-INDEX.md)
- 🇷🇸 **Srpski** — [`docs/sr/00-INDEX.md`](docs/sr/00-INDEX.md)

Each set covers:

| # | Topic |
|---|---|
| 01 | Users, Roles & Permissions |
| 02 | Services, Booking & Appointments |
| 03 | Packages & Package Purchases |
| 04 | Shop, Products & Orders |
| 05 | Coupons & Discounts |
| 06 | The Affiliate / Partner Program |
| 07 | Employee Compensation |
| 08 | Payouts & Balances |
| 09 | Admin Operations |
| 10 | Logs & Audit Trail |
| 11 | External Integrations — Google Calendar & SrediMe |
| 12 | Testing |

For a higher-level walkthrough of *why* each part of the system is built the way it is (business challenge → approach → solution, across every domain), see [`POSLOVNA-LOGIKA.md`](POSLOVNA-LOGIKA.md) (Serbian).

## Admin-configurable settings

Hero image, booking policy (appointment buffer, cancellation/reschedule windows), and currency are all editable from the admin panel (`/admin/sajt`) — no code change or redeploy needed, and changes take effect immediately. Everything else about the catalog (services, packages, products, staff) is entered through the admin panel as well. See `09-admin-operations.md` and `DEPLOYMENT.md`.

## Stack

Node.js · Express 5 · MongoDB / Mongoose 9 · EJS · Bootstrap 5

## Testing

Three layers - unit (mocked dependencies), integration (real HTTP requests against an in-memory MongoDB), and E2E (Playwright, real browser against a real running server). See `docs/en/12-testing.md` / `docs/sr/12-testiranje.md`.

```bash
npm test              # unit + integration
npx playwright test   # E2E
```

## Deployment

PM2 (cluster mode) + nginx + Cloudflare, one deployment per client (hosted white-label, not multi-tenant).

For onboarding a **new client** — environment setup, the one mandatory seed step, first-admin bootstrap, and what's admin-panel-configurable vs. what still needs a manual code change per client — see [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`.env.example`](.env.example).