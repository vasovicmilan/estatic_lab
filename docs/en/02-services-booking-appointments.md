# Services, Booking & Appointments

## The service catalog

A **Service** is a treatment the business offers (a type of massage, a facial, an equipment-based treatment, etc.). Each Service can have multiple **variants** — different durations, different session counts, different prices for what is fundamentally the same treatment. A customer booking a service always picks a specific variant, not just the service itself.

## The booking flow

Booking is a guided, three-step process:

1. **Choose a variant** of the service the customer wants.
2. **Choose a time slot** — either with a specific staff member, or letting the system pick the first available person qualified for that service.
3. **Confirm contact details**, and optionally apply a discount code at this point.

Slot availability is calculated from each staff member's working hours, minus whatever appointments they already have booked, with a 30-minute buffer built in on both sides of each existing appointment so back-to-back bookings don't run into each other without any breathing room for cleanup or prep. This same calculation also accounts for any bookings that came in through SrediMe, an external booking marketplace the business also lists on — see `11-external-integrations.md` for how that sync works.

When a customer doesn't request a specific staff member, the system assigns the first genuinely available person for that service at the moment of booking — checked at the exact instant the appointment is created, so two customers booking the same slot at the same time can't both succeed and end up double-booked. If more than one staff member is genuinely free, the appointment is deliberately left unassigned rather than picked arbitrarily, so an administrator makes that call instead.

## What a booking costs

A booked appointment is priced one of two ways, and only ever one of them for any single appointment:

- **Paid normally** — the variant's listed price, minus a discount code if one was applied.
- **Covered by an existing package** — if the customer has previously purchased a multi-session package that includes this service, they can use one of their remaining sessions instead of paying again. In this case, there's no new charge for the appointment itself — the cost was already covered when the package was purchased.

These two paths are mutually exclusive by design: an appointment paid for with a package can't *also* carry its own separate discount code, since there's no new payment for a coupon to discount in the first place.

## The lifecycle of an appointment

An appointment moves through a defined set of stages:

- **Pending** — booked, awaiting confirmation.
- **Confirmed** — accepted by staff or admin.
- **Completed** — the appointment took place. This is also the moment any commission tied to the appointment becomes payable (see `07-employee-compensation.md` and `06-affiliate-partner-program.md`).
- **Rejected** — declined before it happened.
- **Cancelled** — called off. A customer cancelling their own appointment is held to a 24-hour-in-advance cutoff, protecting staff against last-minute cancellations; staff and admin can cancel an appointment on the customer's behalf at any notice.
- **No-show** — the appointment was confirmed, but the customer never arrived.

Who is allowed to move an appointment from one stage to another depends on their role — a customer can cancel their own upcoming appointment, but only staff or admin can mark something completed or a no-show.

An appointment with an assigned staff member who has calendar sync configured is also pushed to that staff member's Google Calendar, and kept in step as its status changes — see `11-external-integrations.md` for exactly what triggers a create, an update, or a removal.

## Modifying an existing appointment

Two different things can change about an appointment after it's booked, and they're deliberately separate actions:

- **Reassigning** — changing *who* performs the appointment, without touching the time. Available to an administrator, from the appointment's detail page, to any staff member who is qualified for the service, working at that exact time, and not already booked elsewhere then.
- **Rescheduling** — changing *when* the appointment happens, without touching who performs it. Available to the customer, the assigned staff member, or an administrator.

Rescheduling is governed by how much notice there is before the appointment's *current* start time, for anyone other than an administrator (an administrator can reschedule at any notice):

| Notice before the current start time | What's allowed |
|---|---|
| 24 hours or more | Any future day and time (subject to the same working-hours and availability checks a fresh booking goes through) |
| Between 4 and 24 hours | Still allowed, but only to a different time on the *same calendar day* |
| Less than 4 hours | Not allowed |

Regardless of which tier applies, the newly chosen time always has to be at least 30 minutes from the moment the reschedule is requested — nobody can move an appointment to a time that's already effectively now.