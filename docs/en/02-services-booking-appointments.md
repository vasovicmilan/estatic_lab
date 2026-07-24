# Services, Booking & Appointments

## The service catalog

A **Service** is a treatment the business offers (a type of massage, a facial, an equipment-based treatment, etc.). Each Service can have multiple **variants** — different durations, different session counts, different prices for what is fundamentally the same treatment. A customer booking a service always picks a specific variant, not just the service itself.

## The booking flow

Booking is a guided, three-step process:

1. **Choose a variant** of the service the customer wants.
2. **Choose a time slot** — either with a specific staff member, or letting the system pick the first available person qualified for that service.
3. **Confirm contact details**, and optionally apply a discount code at this point.

Slot availability is calculated from each staff member's working hours, minus whatever appointments they already have booked, with a buffer built in between appointments so back-to-back bookings don't run into each other.

When a customer doesn't request a specific staff member, the system assigns the first genuinely available person for that service at the moment of booking — checked at the exact instant the appointment is created, so two customers booking the same slot at the same time can't both succeed and end up double-booked.

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
- **Cancelled** — called off, by the customer or on their behalf, with a same-day cutoff protecting against last-minute cancellations.
- **No-show** — the appointment was confirmed, but the customer never arrived.

Who is allowed to move an appointment from one stage to another depends on their role — a customer can cancel their own upcoming appointment, but only staff or admin can mark something completed or a no-show.
