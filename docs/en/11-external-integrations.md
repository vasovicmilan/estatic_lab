# External Integrations — Google Calendar & SrediMe

The business also lists its services on **SrediMe**, a third-party beauty-booking marketplace — customers can book directly through SrediMe, not just through this site. That creates an obvious risk: a slot could be booked here and on SrediMe at the same time, for the same employee, without either system knowing about the other.

Rather than integrating directly with SrediMe's own systems, both sides route through **Google Calendar** as a shared, neutral meeting point — one calendar per employee. This file covers both directions of that sync, and why they work differently from each other.

## Direction 1: this platform → Google Calendar → SrediMe

Each employee can optionally have a **Google Calendar ID** configured on their profile. When they do, every appointment assigned to them is automatically pushed to that calendar as an event, and kept in sync as the appointment changes:

- **Created** — as soon as an appointment has an assigned employee (immediately at booking time, or later if an admin assigns one), an event is created on that employee's calendar.
- **Rescheduled** — the existing event's time is updated in place.
- **Reassigned to a different employee** — the event is removed from the previous employee's calendar and created fresh on the new one (a calendar event can't be transferred between two different calendars, only recreated).
- **Cancelled or rejected** — the event is removed. The appointment itself stays on record in this system either way; only its calendar footprint disappears, since a customer-facing calendar has no need to show a booking that fell through.
- **Completed or marked as a no-show** — the event is left untouched, as a historical record. Both of these only ever happen to appointments already in the past, so there's no future double-booking risk either way.
- **Permanently deleted by an administrator** — the event is removed, the same as a cancellation.

An appointment's calendar event runs 30 minutes past its actual end time — the same buffer the booking engine itself uses internally (see `02-services-booking-appointments.md`) — so a system reading this calendar sees the same "occupied" window this platform already enforces, rather than needing to know about that buffer policy on its own.

If an employee has no Google Calendar configured, or the sync service is unreachable, none of this blocks the appointment itself — calendar sync is a side effect of booking, never a precondition for it.

**SrediMe's role in this direction:** SrediMe reads directly from that same Google Calendar (via a "secret address" iCal link Google generates for it, entered once into SrediMe's own settings for that employee). This is one-way and entirely on SrediMe's side — this platform has no further involvement once the event is on the calendar.

## Direction 2: SrediMe → this platform

The reverse direction — knowing about a booking a customer made *through SrediMe* — works differently, because SrediMe doesn't write into a shared Google Calendar; it only reads from one.

Instead, each employee can have a separate **SrediMe ICS feed URL** configured (a link SrediMe generates for exporting that employee's SrediMe bookings). A scheduled job checks this feed every 15 minutes, for every employee who has one configured, and records what it finds as a cached set of "busy" time blocks — one entry per SrediMe booking, matched to that same booking on future checks so a reschedule updates it in place, and removed automatically once its booking no longer appears in the feed (a SrediMe-side cancellation).

These cached busy blocks are treated exactly like this platform's own appointments in two places:

- **When a customer is shown available slots**, SrediMe bookings are subtracted from availability the same way existing appointments are.
- **At the moment a fresh booking is actually confirmed** — including the system's own automatic choice of employee when the customer didn't request one — the same SrediMe-derived busy blocks are checked again as a final safeguard, not just at slot-display time, since the display a customer saw may be a few minutes stale by the time they actually book.

> An administrator's list of eligible employees when reassigning or rescheduling an existing appointment is also filtered against these same SrediMe busy blocks. The final write for those two actions, however, does not re-check them the way a fresh booking does — a narrow, known gap worth closing.

Because this check happens on a periodic schedule rather than in real time, there's an unavoidable — but bounded, at most 15 minutes — window in which a booking made on SrediMe hasn't been picked up here yet. This is a deliberate tradeoff: polling periodically is far simpler and more resilient than depending on SrediMe notifying this system the instant something changes, at the cost of that small window. The same 30-minute buffer used everywhere else in the booking engine also applies to these blocks, for consistency.

## Why two separate mechanisms instead of one shared calendar

It would be simpler if SrediMe wrote its own bookings directly into the same Google Calendar this platform writes to, and everything flowed through one shared calendar in both directions. That isn't how SrediMe's own integration works, though — their calendar import is explicitly one-way (they read external calendars, they don't write into them), so a separate, independent SrediMe-facing pull is genuinely necessary to close the loop in the other direction.