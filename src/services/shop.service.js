import productService from "./product.service.js";
import userService from "./user.service.js";
import tempOrderService from "./temporary-order.service.js";
import orderService from "./order.service.js";
import { validationError, badRequest } from "../utils/error.util.js";

// ==================== CART ====================
// Two cart representations exist: a logged-in user's persisted `User.cart` (see
// user.service.js), and a guest's session-held array of {productId, variantId,
// quantity} with no _id of its own. Every function here takes both `userId` and
// `guestCart` and picks whichever applies - the controller is responsible for
// reading/writing `guestCart` to/from the session, this layer never touches req.session.

// Mirrors mapUserCart's shape but resolves from a raw id array instead of a
// populated User document, since a guest has no User doc to populate. Some
// duplication with mapUserCart is accepted here rather than forcing the two very
// different input shapes through one shared function.
async function resolveGuestCart(guestCart = []) {
  const lines = [];

  for (const line of guestCart) {
    try {
      const { product, variation } = await productService.getVariationRaw(line.productId, line.variantId);
      const image = variation.image || product.image;
      lines.push({
        productId: line.productId,
        productSlug: product.slug,
        variantId: line.variantId,
        naziv: product.name,
        varijanta: variation.label,
        sku: variation.sku || product.sku,
        cena: variation.price,
        kolicina: line.quantity,
        ukupno: variation.price * line.quantity,
        slika: image ? { url: image.img, alt: image.imgDesc } : null,
        naStanju: variation.stock > 0,
        dostupnaKolicina: variation.stock,
        prekoracenje: line.quantity > variation.stock,
      });
    } catch {
      // product/variant no longer exists or went inactive since it was added -
      // silently drop it rather than let a stale cart line break the cart page
    }
  }

  return {
    stavke: lines,
    brojStavki: lines.reduce((sum, l) => sum + l.kolicina, 0),
    ukupnaCena: lines.reduce((sum, l) => sum + l.ukupno, 0),
  };
}

export async function getCart({ isLoggedIn = false, userId = null, guestCart = [] } = {}) {
  if (isLoggedIn && userId) return userService.getCart(userId);
  return resolveGuestCart(guestCart);
}

export async function addToCart({ isLoggedIn = false, userId = null, guestCart = [], productId, variantId, quantity = 1 }) {
  if (!productId) validationError("productId");
  if (!variantId) validationError("variantId");
  if (!quantity || quantity <= 0) validationError("quantity");

  if (isLoggedIn && userId) {
    const cart = await userService.addToCart(userId, { productId, variantId, quantity });
    return { cart, guestCart };
  }

  // throws if the variant doesn't exist or isn't active
  await productService.getVariationRaw(productId, variantId);

  const existing = guestCart.find((l) => l.productId === productId && l.variantId === variantId);
  const updatedGuestCart = existing
    ? guestCart.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
    : [...guestCart, { productId, variantId, quantity }];

  const cart = await resolveGuestCart(updatedGuestCart);
  return { cart, guestCart: updatedGuestCart };
}

export async function updateCartItemQuantity({ isLoggedIn = false, userId = null, guestCart = [], cartItemId = null, productId, variantId, quantity }) {
  if (quantity == null) validationError("quantity");

  if (isLoggedIn && userId) {
    if (!cartItemId) validationError("cartItemId");
    const cart = await userService.updateCartItemQuantity(userId, cartItemId, quantity);
    return { cart, guestCart };
  }

  if (!productId) validationError("productId");
  if (!variantId) validationError("variantId");

  const updatedGuestCart =
    quantity <= 0
      ? guestCart.filter((l) => !(l.productId === productId && l.variantId === variantId))
      : guestCart.map((l) => (l.productId === productId && l.variantId === variantId ? { ...l, quantity } : l));

  const cart = await resolveGuestCart(updatedGuestCart);
  return { cart, guestCart: updatedGuestCart };
}

export async function removeFromCart({ isLoggedIn = false, userId = null, guestCart = [], cartItemId = null, productId, variantId }) {
  if (isLoggedIn && userId) {
    if (!cartItemId) validationError("cartItemId");
    const cart = await userService.removeFromCart(userId, cartItemId);
    return { cart, guestCart };
  }

  const updatedGuestCart = guestCart.filter((l) => !(l.productId === productId && l.variantId === variantId));
  const cart = await resolveGuestCart(updatedGuestCart);
  return { cart, guestCart: updatedGuestCart };
}

// ==================== CHECKOUT ====================

/**
 * Creates the pending (temporary) order - the real Order only exists once the
 * customer confirms via the emailed token (see temporary-order.service.js /
 * order.service.js's confirmOrder). Clears the logged-in user's cart on success,
 * since its contents are now earmarked in the pending order; a guest's session cart
 * is left for the controller to clear once it hands back the response.
 */
export async function checkout({ isLoggedIn = false, userId = null, guestCart = [], contact, phone, address, note, couponCode }) {
  let items;

  if (isLoggedIn && userId) {
    const cart = await userService.getCart(userId);
    if (!cart.stavke.length) badRequest("Korpa je prazna");
    items = cart.stavke.map((s) => ({ productId: s.productId, variantId: s.variantId, quantity: s.kolicina }));
  } else {
    if (!guestCart.length) badRequest("Korpa je prazna");
    items = guestCart.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
  }

  const result = await tempOrderService.createTemporaryOrder({
    items,
    isLoggedIn,
    userId,
    contact,
    phone,
    address,
    note,
    couponCode,
  });

  if (isLoggedIn && userId) {
    await userService.clearCart(userId);
  }

  return result;
}

export async function confirmOrder(orderId, token) {
  return orderService.confirmOrder(orderId, token);
}

export default {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  checkout,
  confirmOrder,
};