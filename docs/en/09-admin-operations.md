# Admin Operations

This is a summary of what an administrator can see and manage across the platform. Individual areas are covered in more depth in their own files; this one is the map.

## Catalog management

Full control over what's offered and sold: services and their variants, multi-session packages and what they bundle, physical products and their variations, and the categories and tags used to organize all of it. The content side of the site — blog posts and general marketing content — is managed the same way.

## People management

Administrators manage every account type on the platform:

- **Users** — general customer accounts, including their status and role.
- **Employees** — staff profiles, their compensation setup, the services they're qualified for, and their working hours.
- **Partners** — referral-program participants and their commission rate.

Promoting a user into an Employee or Partner profile is handled with the safeguard described in `01-users-roles-permissions.md`, so it never accidentally reduces someone's existing access.

## Bookings and orders

Administrators have full visibility into every appointment and every shop order, and can move either through its lifecycle on behalf of a customer or staff member when needed — confirming, completing, cancelling, and so on, following the same rules described in `02-services-booking-appointments.md` and `04-shop-products-orders.md`.

## Package purchases

Since package purchases are recorded by an administrator rather than self-served by the customer (see `03-packages-and-purchases.md`), this is also where a package purchase actually gets created — selecting the customer, the package, and optionally applying a discount code, with the resulting price shown before the purchase is finalized.

## Marketing tools

Discount codes, referral-linked coupons, and the payout side of the partner program are all managed from the admin panel, alongside general marketing content like the newsletter and testimonials.

## Oversight and reporting

Administrators have access to operational reporting and an accountability trail covering actions taken across the platform — covered in full in `10-logs-and-audit-trail.md`.
