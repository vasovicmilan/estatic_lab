# The Affiliate / Partner Program

This is the platform's referral system: partners refer customers via a personal link, and earn commission on what those referrals purchase. This file covers the whole program end to end.

## How a referral gets attributed

Each partner has a unique referral code, embedded in a personal link they share (`beautymedica.rs/?code=THEIRCODE`, or a link to a specific service, package, or product with the same code attached). The moment anyone visits the site with that code in the URL — any page, not just the homepage — it's remembered for that visitor for the next 30 days, regardless of how many other pages they browse in the meantime or whether they complete a purchase on that same visit.

This means a partner gets credit correctly even when a referred customer browses around for a while, leaves, and comes back later to actually book or buy something — as long as it's within that 30-day window.

## Where attribution is applied automatically

When a referred visitor reaches the point of actually completing a booking or a checkout, their remembered referral code is automatically applied as a discount — the customer gets the benefit of the partner's code without needing to remember or re-enter it themselves. This happens independently for bookings and for shop checkouts, so a visitor who was referred while browsing a service can still get that same referral properly recognized later if they instead end up buying something from the shop, and vice versa.

## Careful attribution on general inquiries

The one place referral attribution is handled deliberately narrowly is the general contact form. A referral is only ever attached to a contact submission when the visitor reached the contact page for a *specific* reason tied to that referral — for example, following a "get in touch about this package" link. A visitor who was referred at some point but later submits a completely unrelated, general inquiry does not have that inquiry attributed to the referral. This protects against a partner receiving credit for something that had nothing to do with their referral in the first place.

## What actually earns a partner commission

Commission is generated specifically when a referral code that belongs to a partner is used on a purchase — a booking, a package purchase, or a shop order. An ordinary promotional discount code (one not tied to any partner) never generates commission, regardless of how it's used; only a genuine referral code does.

Three kinds of purchases can generate partner commission, and each is handled with timing appropriate to how reversible that type of purchase actually is:

- **A booked appointment** — commission becomes payable as soon as the appointment is marked completed. Once a service has actually been delivered, there's nothing left that could still reverse it.
- **A shop order** — commission starts out reserved rather than immediately payable, for a two-week window that mirrors the customer's standard right to return the item. If the order is returned or cancelled within that window, no commission is paid. If the order instead reaches its own fully-settled completed state before the window closes, the commission becomes payable right away — there's no reason to keep waiting once the order is genuinely final. Otherwise, once the window passes without a return, the commission becomes payable automatically.
- **A package purchase** — since a package is paid for and recorded at the time of purchase (not through an online payment that could still be disputed), commission on it becomes payable immediately. If the package purchase is later cancelled, the commission that was already credited for it is properly reversed.

## Partners and staff commission are independent of each other

A referred package purchase and the staff commission earned later when someone actually uses a session from that package are two entirely separate things. A partner earns their commission once, when the referral led to the sale itself. Separately, if a commission-based staff member performs a session from that package, their own commission is calculated on the real value of the service they performed — see `07-employee-compensation.md` for exactly how that's valued fairly even though the customer isn't paying anything new at that specific appointment.

## Requesting and receiving payment

A partner can see, at any time, their running totals: how much they've earned in total, how much has already been paid out to them, how much is currently reserved (pending the order-return window above), and how much is genuinely available to request right now. They can request a payout for any amount up to what's currently available.

An administrator reviews payout requests and can approve them, mark them paid, or decline them with an explanation — or record a payout directly without waiting for a request, for cases handled outside the normal request flow. Whichever path is used, the partner is notified by email the moment their payout's status changes, so they always know where things stand without needing to ask.

## The partner's own dashboard

Every partner has a personal account area covering:

- An overview of their current balance and a quick way to request a payout.
- A full, searchable history of every commission they've earned, filterable by status and by what kind of purchase it came from.
- A full history of every payout they've requested and its outcome.
- A "catalog" page listing every service, package, and product on the site, each with their personal referral link already built in and ready to copy — so sharing a specific offer doesn't require constructing a link by hand.
