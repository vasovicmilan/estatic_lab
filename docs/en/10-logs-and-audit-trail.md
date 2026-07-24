# Logs & Audit Trail

The platform maintains two distinct kinds of records for oversight purposes, answering two different kinds of questions.

## Operational health reporting

The system continuously tracks how the site itself is performing — how much traffic it's getting, how many requests succeed versus fail, and how quickly pages are responding. This is available to administrators in two forms:

- **A live view of today so far** — a real-time snapshot of the current day's activity, available at any point without waiting for the day to finish.
- **A historical record** — a searchable archive of every previous day's summary, letting administrators look back and spot patterns or compare periods.

This answers questions like: is the site running normally right now, was there an unusual spike in errors on a particular day, and which parts of the site are slowest to respond.

## The accountability trail

Separately, the platform maintains a detailed record of significant actions taken by administrators and other staff — creating or changing a partner, adjusting an employee's pay setup, approving or rejecting a payout, updating a product's price, and similar actions across the catalog and people-management areas.

For each recorded action, the system captures:

- **Who** performed it, and what role they held at the time.
- **When** it happened.
- **What changed**, specifically — for an update, exactly which fields were altered and what their values were before and after.
- **Where from** — the IP address and browser the action was performed from.
- **Whether it succeeded** — including a reason if it didn't.

This means questions like "who changed this price, and what was it before," "who approved this payout, and when," or "did this action actually succeed" all have a direct, reliable answer, rather than relying on memory or informal notes.
