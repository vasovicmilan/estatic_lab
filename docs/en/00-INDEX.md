# Estatic Lab — Documentation Index

This documentation is split into focused files, each covering one area of the business end to end: what it does, why it's designed that way, and how the pieces fit together. Read the index below to find the right file for what you need.

| File | Covers |
|---|---|
| `01-users-roles-permissions.md` | Account types, roles, permission model, promotion safeguards |
| `02-services-booking-appointments.md` | Service catalog, the booking flow, appointment lifecycle |
| `03-packages-and-purchases.md` | Multi-session package bundles, how they're sold, how sessions get consumed |
| `04-shop-products-orders.md` | Product catalog, cart, checkout, order lifecycle |
| `05-coupons-and-discounts.md` | Discount codes, how they apply, what they can restrict |
| `06-affiliate-partner-program.md` | The referral program end to end: capture, attribution, commission, payout |
| `07-employee-compensation.md` | Salary vs. commission employees, how commission is calculated, including package-consumed sessions |
| `08-payouts-and-balances.md` | How an earner's payable balance is calculated and how money actually moves |
| `09-admin-operations.md` | What administrators can see and do across the platform |
| `10-logs-and-audit-trail.md` | Operational visibility and accountability — who did what, and site health reporting |
| `11-external-integrations.md` | Two-way sync with Google Calendar (per-employee calendars) and the SrediMe booking marketplace |
| `12-testing.md` | The three test layers (unit, integration, E2E), what each covers, how to run them, and patterns/gotchas discovered while writing E2E tests |
| `13-business-reports.md` | Business reports (bookings, shop, packages, commissions, coupons) — live current period vs. saved history, automatic and manual generation, email and PDF |

Each file stands on its own — you don't need to read them in order, though `06` (affiliate program) draws on concepts from `03`, `05`, and `07`, and `11` builds on the appointment lifecycle described in `02`.