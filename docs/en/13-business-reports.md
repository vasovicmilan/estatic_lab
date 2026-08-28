# Business Reports

The platform tracks two distinct kinds of reporting. `10-logs-and-audit-trail.md` covers the site's **operational** health — traffic, errors, response times. This file covers the **business** numbers — how much is being earned and through which channels: bookings, the shop, packages, commissions, and coupons. Different questions, so different reporting systems, though they share the same underlying pattern (a live current period, a saved history per period, email delivery with a PDF attachment).

## What a report contains

Every business report has five sections:

- **Bookings** — total appointments, revenue, the no-show rate, a breakdown by appointment status, and revenue broken down by service and by employee.
- **Shop** — total orders, revenue, average order value, and best-selling products.
- **Packages** — how many packages were sold in the period and the revenue from them.
- **Commissions** — how much employees and partners earned and how much has already been paid out to them in that period (see `07-employee-compensation.md` and `08-payouts-and-balances.md` for how those figures themselves are calculated).
- **Coupons** — how many times coupons were redeemed and the total discount given, broken down per coupon.

## Periods

The report exists in five variants: daily, weekly, monthly, quarterly, and yearly. Each period's boundaries (exactly when a "day" or "week" starts and ends) are computed in the business's own timezone (Europe/Belgrade), not the server's UTC clock - without that, a two-hour shift at the boundary would push some late-evening appointments into the wrong day.

## Current period vs. history

This is the most important distinction to understand about the system: the **current, still-in-progress period** and the **history of completed periods** work in fundamentally different ways.

The current period - today, say, before the day is over - is never saved to the database. Instead, every time the business reports dashboard loads in admin, the numbers are recomputed live, at that exact moment, directly from whatever appointments and orders exist so far. This is deliberate: a period that's still running doesn't have final numbers yet, so persisting a "current snapshot" wouldn't make sense - it would already be stale a minute later. The same principle is used for operational reporting in `10-logs-and-audit-trail.md`.

Once a period actually ends (a full day, a full week, and so on has passed), the system generates and **permanently saves** its final snapshot. That snapshot never changes again and is what shows up in history, with a detail view per individual period.

## Automatic and manual generation

Each period type has a scheduled nightly job that, as soon as that period ends, computes and saves its final report and emails it to the admin. The same thing can be triggered manually, following the same pattern as the operational reports:

```
npm run report:business-daily
npm run report:business-weekly
npm run report:business-monthly
npm run report:business-quarterly
npm run report:business-yearly
```

This is useful for generating the previous period's report immediately without waiting for the nightly cycle, or for manually verifying that reporting is working correctly.

## Email and PDF

Every saved (non-current) report is emailed to the admin, showing the same numbers as the admin view. A **PDF version** of the report is attached to that email too - suited for archiving or sharing outside the system. That same PDF can also be downloaded later, at any time, from any saved report's detail page in admin, via the "Preuzmi PDF" button.

PDF generation can't block the email from sending - if the PDF fails to build for any reason, the email with the numbers still goes out, just without the attachment.

Every PDF report on the platform (business reports and order confirmations alike) embeds a font that correctly renders every Serbian Latin character (š, đ, č, ć, ž). The default fonts built into the PDF library the platform uses don't support them - without the embedded font, those letters would either disappear or render incorrectly in the PDF.

## Where this all shows up in admin

The business reports landing page (`/admin/poslovni-izvestaji`) shows all five period types live, clearly labeled as such. Each period type has its own history (`/admin/poslovni-izvestaji/istorija/:type`), and every saved period has its own detail page with the full category breakdown and a PDF download button.
