# Shop, Products & Orders

## The product catalog

Alongside services, the platform sells physical **Products** (retail items, take-home care products, and similar). Each product can have multiple **variations** — different sizes, formulations, or configurations — each with its own price and stock level tracked independently.

## Cart and checkout

Customers build a cart (whether they're logged in or browsing as a guest) and check out through a standard flow: contact and delivery details, an optional discount code, and order confirmation. Guests confirm their order via a secure link sent to their email, so they don't need to create an account to complete a purchase.

## The lifecycle of an order

An order moves through a defined sequence as it's fulfilled:

**Pending → Processing → Shipped → Delivered → Completed**

Along the way, an order can instead be **cancelled** (before it ships), **returned** (after the customer receives it), or **refunded**. Once an order reaches **Completed**, it's genuinely final — there's no path back from there to a cancellation, return, or refund. This finality matters directly for how commission on referred orders is timed (see `06-affiliate-partner-program.md`) — a completed order is treated as fully settled, with nothing left that could still be reversed.

## Discounts on orders

An order can carry a single discount code, applied at checkout, the same way a booking can. See `05-coupons-and-discounts.md` for how discount codes work and what they can be restricted to.
