import * as shopService from "../../../services/shop.service.js";
import * as userService from "../../../services/user.service.js";
import {
  prepareCartData,
  prepareCheckoutStepData,
  prepareCheckoutPendingData,
  prepareOrderConfirmedData,
} from "../../../presenters/public/shop.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";
import { normalizeError } from "../../../utils/error.util.js";
import { getCapturedReferralCode } from "../../../middlewares/coupon-capture.middleware.js";
import { tryApplyCoupon } from "./coupon.controller.js";

function getAuth(req) {
  const isLoggedIn = !!req.session?.isLoggedIn;
  return { isLoggedIn, userId: isLoggedIn ? req.session.user.id : null };
}

function getGuestCart(req) {
  return req.session.cart || [];
}

export async function cartPage(req, res, next) {
  try {
    const { isLoggedIn, userId } = getAuth(req);
    const cart = await shopService.getCart({ isLoggedIn, userId, guestCart: getGuestCart(req) });
    const viewData = prepareCartData(cart);

    return res.render("shop/cart", {
      pageTitle: "Korpa",
      pageDescription: "Pregled vaše korpe",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[cartPage] Greška pri učitavanju korpe", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function addToCart(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[addToCart] Validacione greške pri dodavanju u korpu", { validationErrors: req.validationErrors });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), req.get("Referrer") || "/prodavnica");
    }

    const { isLoggedIn, userId } = getAuth(req);
    const { cart, guestCart } = await shopService.addToCart({
      isLoggedIn,
      userId,
      guestCart: getGuestCart(req),
      productId: req.body.productId,
      variantId: req.body.variantId,
      quantity: parseInt(req.body.quantity, 10) || 1,
    });
    req.session.cart = guestCart;

    logInfo("[addToCart] Proizvod dodat u korpu", { userId, productId: req.body.productId, brojStavki: cart.brojStavki });
    return flashAndRedirect(req, res, "success", "Proizvod je dodat u korpu", "/korpa");
  } catch (error) {
    logError("[addToCart] Greška pri dodavanju u korpu", error, { body: req.body, userId: req.session?.user?.id });
    const { message } = normalizeError(error);
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", message, req.get("Referrer") || "/prodavnica");
    }
    next(error);
  }
}

export async function updateCartItem(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[updateCartItem] Validacione greške pri izmeni korpe", { validationErrors: req.validationErrors });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), "/korpa");
    }

    const { isLoggedIn, userId } = getAuth(req);
    const { guestCart } = await shopService.updateCartItemQuantity({
      isLoggedIn,
      userId,
      guestCart: getGuestCart(req),
      cartItemId: req.body.cartItemId || null,
      productId: req.body.productId,
      variantId: req.body.variantId,
      quantity: parseInt(req.body.quantity, 10),
    });
    req.session.cart = guestCart;

    return flashAndRedirect(req, res, "success", "Korpa je ažurirana", "/korpa");
  } catch (error) {
    logError("[updateCartItem] Greška pri izmeni korpe", error, { body: req.body, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/korpa");
    }
    next(error);
  }
}

export async function removeCartItem(req, res, next) {
  try {
    const { isLoggedIn, userId } = getAuth(req);
    const { guestCart } = await shopService.removeFromCart({
      isLoggedIn,
      userId,
      guestCart: getGuestCart(req),
      cartItemId: req.body.cartItemId || null,
      productId: req.body.productId,
      variantId: req.body.variantId,
    });
    req.session.cart = guestCart;

    return flashAndRedirect(req, res, "success", "Stavka je uklonjena iz korpe", "/korpa");
  } catch (error) {
    logError("[removeCartItem] Greška pri uklanjanju iz korpe", error, { body: req.body, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/korpa");
    }
    next(error);
  }
}

export async function checkoutStep(req, res, next) {
  try {
    const { isLoggedIn, userId } = getAuth(req);
    const cart = await shopService.getCart({ isLoggedIn, userId, guestCart: getGuestCart(req) });

    if (!cart.stavke.length) {
      return flashAndRedirect(req, res, "error", "Vaša korpa je prazna", "/korpa");
    }

    const addresses = isLoggedIn ? await userService.getAddresses(userId) : [];
    const user = isLoggedIn ? await userService.findUserProfile(userId) : null;

    const viewData = prepareCheckoutStepData(cart, { isLoggedIn, user, addresses });

    if (req.session.activeCoupon?.context !== "order") {
      const referralCode = getCapturedReferralCode(req);
      if (referralCode) {
        await tryApplyCoupon(req, { code: referralCode, context: "order", productIds: viewData.productIds, orderValue: viewData.orderValue });
      }
    }

    return res.render("shop/checkout", {
      pageTitle: "Naplata",
      pageDescription: "Unesite podatke za dostavu",
      data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "order" ? req.session.activeCoupon : null, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[checkoutStep] Greška pri učitavanju naplate", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function submitCheckout(req, res, next) {
  const { firstName, lastName, email, phone, city, postalCode, street, number, note } = req.body;

  try {
    const { isLoggedIn, userId } = getAuth(req);

    if (req.validationErrors) {
      logWarn("[submitCheckout] Validacione greške pri naplati", { validationErrors: req.validationErrors, email });
      const cart = await shopService.getCart({ isLoggedIn, userId, guestCart: getGuestCart(req) });
      const addresses = isLoggedIn ? await userService.getAddresses(userId) : [];
      const user = isLoggedIn ? await userService.findUserProfile(userId) : null;
      const viewData = prepareCheckoutStepData(cart, { isLoggedIn, user, addresses, errors: req.validationErrors });
      return res.status(400).render("shop/checkout", {
        pageTitle: "Naplata",
        pageDescription: "Unesite podatke za dostavu",
        data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "order" ? req.session.activeCoupon : null, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    // see coupon.controller.js - only ever set once validateCouponForOrder has
    // already confirmed the code works against what's actually in the cart
    const activeCoupon = req.session?.activeCoupon?.context === "order" ? req.session.activeCoupon : null;

    const result = await shopService.checkout({
      isLoggedIn,
      userId,
      guestCart: getGuestCart(req),
      contact: { firstName, lastName, email },
      phone,
      address: { city, postalCode, street, number },
      note,
      couponCode: activeCoupon?.code || null,
    });

    delete req.session.activeCoupon;

    logInfo(`[submitCheckout] Privremena porudžbina kreirana za "${email}"`, { temporaryOrderId: result.id, accountJustCreated: result.accountJustCreated });

    if (!isLoggedIn) req.session.cart = [];
    req.session.pendingCheckoutConfirmation = { orderId: result.id, email, tokenExpiration: result.tokenExpiration };

    return res.redirect("/korpa/potvrdite-porudzbinu");
  } catch (error) {
    logError("[submitCheckout] Greška pri naplati", error, { email, userId: req.session?.user?.id });

    if (error.statusCode === 400) {
      try {
        const { isLoggedIn, userId } = getAuth(req);
        const cart = await shopService.getCart({ isLoggedIn, userId, guestCart: getGuestCart(req) });
        const addresses = isLoggedIn ? await userService.getAddresses(userId) : [];
        const user = isLoggedIn ? await userService.findUserProfile(userId) : null;
        const viewData = prepareCheckoutStepData(cart, { isLoggedIn, user, addresses, errors: { general: error.message } });
        return res.status(400).render("shop/checkout", {
          pageTitle: "Naplata",
          pageDescription: "Unesite podatke za dostavu",
          data: { ...viewData, activeCoupon: req.session?.activeCoupon?.context === "order" ? req.session.activeCoupon : null, formData: req.body, csrfToken: res.locals.csrfToken },
        });
      } catch (renderError) {
        logError("[submitCheckout] Greška pri ponovnom renderovanju forme nakon neuspešne naplate", renderError);
        return flashAndRedirect(req, res, "error", error.message, "/korpa/naplata");
      }
    }
    next(error);
  }
}

// GET /korpa/potvrdite-porudzbinu - one-time "check your email" screen, same
// session-carry pattern as booking.controller.js's confirmation view
export async function checkoutPending(req, res, next) {
  try {
    const pending = req.session.pendingCheckoutConfirmation;
    delete req.session.pendingCheckoutConfirmation;

    if (!pending) {
      return res.redirect("/");
    }

    const viewData = prepareCheckoutPendingData(pending);

    return res.render("shop/order-pending", {
      pageTitle: "Potvrdite porudžbinu",
      pageDescription: "Proverite email da potvrdite porudžbinu",
      data: viewData,
    });
  } catch (error) {
    logError("[checkoutPending] Greška pri prikazu ekrana za potvrdu", error);
    next(error);
  }
}

// GET /korpa/potvrda/:orderId/:token - clicked from the confirmation email
export async function confirmOrder(req, res, next) {
  try {
    const { orderId, token } = req.params;
    const order = await shopService.confirmOrder(orderId, token);

    logInfo(`[confirmOrder] Porudžbina potvrđena`, { orderId: order.id });

    const viewData = prepareOrderConfirmedData(order);
    return res.render("shop/order-confirmed", {
      pageTitle: "Porudžbina potvrđena",
      pageDescription: "Vaša porudžbina je uspešno potvrđena",
      data: viewData,
    });
  } catch (error) {
    logError("[confirmOrder] Greška pri potvrđivanju porudžbine", error, { orderId: req.params.orderId });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/");
    }
    next(error);
  }
}

export default {
  cartPage,
  addToCart,
  updateCartItem,
  removeCartItem,
  checkoutStep,
  submitCheckout,
  checkoutPending,
  confirmOrder,
};