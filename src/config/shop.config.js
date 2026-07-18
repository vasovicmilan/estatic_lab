export const DEFAULT_SHIPPING_PRICE = Number(process.env.DEFAULT_SHIPPING_PRICE || 350);

// how long a customer has to confirm their order via the emailed token before the
// stock reservation is released and the temporary order is deleted
export const TEMP_ORDER_TOKEN_TTL_MINUTES = Number(process.env.TEMP_ORDER_TOKEN_TTL_MINUTES || 30);

export default { DEFAULT_SHIPPING_PRICE, TEMP_ORDER_TOKEN_TTL_MINUTES };