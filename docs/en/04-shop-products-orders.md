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

## Creating an order manually

An administrator can create an order directly (`/admin/porudzbine/rucno-kreiranje`) — for phone orders, gifts, product bundles and "price on request" items. The order skips the cart and the email confirmation, but from then on behaves like any other (same statuses, same customer email, same commission once completed).

- **Several products** — the "Dodaj proizvod" button adds one row per product (product, variant, quantity), up to 20 lines. Stock is taken for every line inside one transaction: if any line is short, nothing is written.
- **Price per product** — the field is empty by default, which means the variant's catalog price. If the customer didn't pay the regular price for one product, type the unit price in that row only; the others stay on the catalog price. A typed `0` is a real price (free), not "empty".
- **Final price for the goods** — optional. When filled in it **overrides everything**, catalog and typed prices alike: the goods will total exactly that amount. Because an order stores a price per line (for display, the invoice and the per-product sales report), the final amount is spread over the lines in proportion to what each would have cost before the override, so the lines always add up to exactly the final amount (a cent or two of rounding goes to the last line). If every line was priced at 0 it is split by quantity. Shipping is entered separately and added on top of the final price.
- **Price on request** — a "price on request" product needs either its own typed price in its row or a final price for the whole order; the system never charges its internal reference price.
- The form shows the goods total, shipping and grand total live, and keeps everything entered after an error (e.g. out of stock). The audit log records which lines and which final price were entered.

## Shipping

The product catalog ranges from small consumables to large/heavy devices that can't ship via regular post. Every product is tagged as either **standard** shipping (the usual flat, automatically-calculated rate) or **freight** (a large/heavy item).

When a cart contains at least one freight item, shipping isn't priced automatically — the order is flagged as awaiting a shipping quote, and an admin manually enters the real shipping cost (e.g. after negotiating with a courier) before the customer can even confirm the order through the link they received by email. This prevents an order with a missing or wrong shipping cost from ever becoming final.