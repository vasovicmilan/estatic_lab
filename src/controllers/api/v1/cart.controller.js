import * as shopService from "../../../services/shop.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";

// Deliberately auth-only for API v1, unlike the web cart which also supports a
// guest (session-cookie) cart - shopService.getCart/addToCart/etc already branch
// cleanly on isLoggedIn+userId vs a passed-in guestCart array (see shop.service.js),
// and the logged-in path is entirely userId-keyed in the DB with zero session
// dependency, so every call below just always passes isLoggedIn:true, userId:
// req.user.id (guaranteed present - these routes sit behind apiAuthMiddleware).
// Guest-cart support for the API (a client managing its own cart array across
// requests) is a real design question, deliberately deferred rather than bolted on.

export async function getCart(req, res, next) {
  try {
    const cart = await shopService.getCart({ isLoggedIn: true, userId: req.user.id });
    return res.json({ success: true, data: cart });
  } catch (error) {
    logError("[api/getCart] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function addItem(req, res, next) {
  try {
    const { cart } = await shopService.addToCart({
      isLoggedIn: true,
      userId: req.user.id,
      productId: req.body.productId,
      variantId: req.body.variantId,
      quantity: parseInt(req.body.quantity, 10) || 1,
    });
    logInfo("[api/addItem] Proizvod dodat u korpu", { userId: req.user.id, productId: req.body.productId });
    return res.status(201).json({ success: true, data: cart });
  } catch (error) {
    logError("[api/addItem] Greška", error, { body: req.body, userId: req.user.id });
    next(error);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { cart } = await shopService.updateCartItemQuantity({
      isLoggedIn: true,
      userId: req.user.id,
      cartItemId: req.body.cartItemId,
      quantity: parseInt(req.body.quantity, 10),
    });
    return res.json({ success: true, data: cart });
  } catch (error) {
    logError("[api/updateItem] Greška", error, { body: req.body, userId: req.user.id });
    next(error);
  }
}

export async function removeItem(req, res, next) {
  try {
    const { cart } = await shopService.removeFromCart({ isLoggedIn: true, userId: req.user.id, cartItemId: req.body.cartItemId });
    return res.json({ success: true, data: cart });
  } catch (error) {
    logError("[api/removeItem] Greška", error, { body: req.body, userId: req.user.id });
    next(error);
  }
}

// Every checkout - guest or logged-in, web or API - creates a pending
// TemporaryOrder, not an immediate Order (see shop.service.js's checkout /
// tempOrderService.createTemporaryOrder) - the real Order only exists once
// confirmOrder below is hit with the emailed token. Deliberately unchanged here,
// not something to special-case away for the API. Worth knowing for a mobile
// client: the confirmation link in that email currently points at the WEB
// /korpa/potvrda/:orderId/:token URL, not a deep link back into the app - opening
// fine in a browser, but not yet a native in-app flow.
export async function checkout(req, res, next) {
  const { firstName, lastName, email, phone, city, postalCode, street, number, note, couponCode } = req.body;

  try {
    const result = await shopService.checkout({
      isLoggedIn: true,
      userId: req.user.id,
      contact: { firstName, lastName, email },
      phone,
      address: { city, postalCode, street, number },
      note,
      couponCode: couponCode || null,
    });

    logInfo(`[api/checkout] Privremena porudžbina kreirana za "${email}"`, { temporaryOrderId: result.id, userId: req.user.id });

    return res.status(201).json({
      success: true,
      data: { orderId: result.id, email, tokenExpiration: result.tokenExpiration, requiresShippingQuote: result.requiresShippingQuote },
    });
  } catch (error) {
    logError("[api/checkout] Greška", error, { email, userId: req.user.id });
    next(error);
  }
}

// Public/unauthenticated (mirrors GET /korpa/potvrda/:orderId/:token on the web) -
// reached by clicking the link in the confirmation email, which carries its own
// one-time token instead of relying on the caller being logged in.
export async function confirmOrder(req, res, next) {
  try {
    const order = await shopService.confirmOrder(req.params.orderId, req.params.token);
    logInfo("[api/confirmOrder] Porudžbina potvrđena", { orderId: order.id });
    return res.json({ success: true, data: order });
  } catch (error) {
    logError("[api/confirmOrder] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

export default { getCart, addItem, updateItem, removeItem, checkout, confirmOrder };
