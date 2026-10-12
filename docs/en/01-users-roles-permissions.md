# Users, Roles & Permissions

## Account types

Every person who interacts with the platform is a **User**. A User account is the base identity — authentication, contact details, preferences. On top of that base account, a person can additionally hold one specialized profile:

- **Employee** — someone who performs services and can be booked for appointments.
- **Partner** — someone who refers customers to the business via a personal referral link and earns commission on what those referrals purchase.

A single person can, in principle, be more than one of these at once (an employee who is also a partner, for example) — the system is built to support that without conflict.

## Roles

Every User has exactly one **Role**, and a Role is what actually determines what a person can see and do. Four roles exist:

- **Admin** — full operational control of the platform.
- **Employee** — access to their own calendar, assigned appointments, and (if commission-based) their own earnings.
- **Partner** — access to their own referral tools and earnings.
- **User** — the default role for anyone who registers; can book appointments and manage their own orders.

## Permissions

A Role is defined by a list of specific **permissions** — discrete capabilities like managing the product catalog, managing coupons, viewing operational logs, or approving payouts. This is deliberately granular: it means the platform can support a future role like "shop manager" or "marketing coordinator" that has some but not all of Admin's capabilities, without needing new code — just a new Role with the right permission list.

## Promotion safeguards

When someone is promoted into an Employee or Partner profile, the system needs to decide whether their account's Role should change to match. Every role carries a **priority** ranking (Admin highest, then Employee, then Partner, then the default User role lowest). The rule: a promotion only changes someone's role if the new role ranks *higher* than what they already have.

This exists so that promoting, say, an Admin into also being a Partner (so they can test the referral program, or because they genuinely are a business partner too) never accidentally *downgrades* their access — they keep their Admin role, while still gaining a Partner profile underneath it with its own referral link and earnings tracking.
## Web sessions: when they stop being valid

A web session (14 days) stores a snapshot of the role and permissions from login time. So that snapshot cannot outlive an account change, `sessionRevalidation` (`auth.middleware.js`) re-checks the account's status and `tokenValidAfter` at most once per 60 seconds per session (the same fields the Bearer-token path uses). The session is logged out if the account is suspended/inactive/deleted, or if `tokenValidAfter` is newer than the login. `tokenValidAfter` moves on suspend/deactivate, on **role change** (the user must sign in again to pick up the new permissions) and on **password reset**. If the check itself fails (database unavailable) the session is left alone.

On login (password and Google) the session gets a fresh id (`session.regenerate`), and the `redirect` parameter only accepts a same-site path (`/...`). Google sign-in rejects suspended and unconfirmed accounts, and links to an existing local account by email only when Google returns `verified_email: true`.
