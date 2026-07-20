export const DEFAULT_SHIPPING_PRICE = Number(process.env.DEFAULT_SHIPPING_PRICE || 350);

// How long a customer has to confirm their order via the emailed token. Once this
// passes, the customer can no longer self-confirm (see order.service.js's
// confirmOrder) - but the record itself isn't deleted yet, see below.
export const TEMP_ORDER_TOKEN_TTL_MINUTES = Number(process.env.TEMP_ORDER_TOKEN_TTL_MINUTES || 60);

// How much longer, after the token itself has expired, the temporary order (and its
// stock reservation) stays in the database before the cleanup job actually deletes it.
// This is deliberately generous: it's the window during which the customer can reach
// out ("I missed the email, can you still confirm it") and an admin can manually
// confirm it on their behalf (see order.service.js's confirmOrderByAdmin), or admin
// can proactively reach out to the customer to ask if they still want it. Only once
// this full window passes does the reservation actually get released.
export const TEMP_ORDER_RETENTION_HOURS = Number(process.env.TEMP_ORDER_RETENTION_HOURS || 24);

// matches the 14-day statutory withdrawal right (Zakon o zaštiti potrošača,
// already documented in the site's Terms) - a partner-referred order's commission
// stays "pending" until this window has passed, since the customer could still
// return the order and the commission would need to be reversed
export const ORDER_COMMISSION_GRACE_PERIOD_DAYS = Number(process.env.ORDER_COMMISSION_GRACE_PERIOD_DAYS || 14);

export default { DEFAULT_SHIPPING_PRICE, TEMP_ORDER_TOKEN_TTL_MINUTES, TEMP_ORDER_RETENTION_HOURS, ORDER_COMMISSION_GRACE_PERIOD_DAYS };