export function prepareCartData(cart) {
  return {
    cart,
    isEmpty: !cart.stavke.length,
    checkoutUrl: "/korpa/naplata",
    continueShoppingUrl: "/prodavnica",
    breadcrumbs: [{ label: "Korpa", url: null }],
  };
}

// Checkout step: contact/address/phone + coupon. Prefills from the logged-in user's
// profile and default address if they have one - same "don't make them retype what
// we already know" reasoning as prepareBookingContactStepData's prefill.
export function prepareCheckoutStepData(cart, { isLoggedIn = false, user = null, addresses = [], errors = {} } = {}) {
  const defaultAddress = addresses.find((a) => a.podrazumevana) || addresses[0] || null;

  return {
    cart,
    isLoggedIn,
    prefill: isLoggedIn
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.telefon || "",
        }
      : { firstName: "", lastName: "", email: "", phone: "" },
    addresses,
    addressPrefill: defaultAddress
      ? { city: defaultAddress.grad, postalCode: defaultAddress.postanskiBroj, street: defaultAddress.ulica, number: defaultAddress.broj }
      : { city: "", postalCode: "", street: "", number: "" },
    errors,
    breadcrumbs: [
      { label: "Korpa", url: "/korpa" },
      { label: "Naplata", url: null },
    ],
  };
}

// Shown right after the temp order is created - there's no real Order yet, so this
// only shows the confirmation-email prompt and the token's expiry, not order details.
export function prepareCheckoutPendingData({ email, tokenExpiration } = {}) {
  return {
    email,
    tokenExpiration,
    breadcrumbs: [{ label: "Potvrdite porudžbinu", url: null }],
  };
}

// Shown after the customer clicks the emailed confirmation link and the real Order
// now exists.
export function prepareOrderConfirmedData(order, { accountJustCreated = false } = {}) {
  return {
    order,
    accountJustCreated, // true when a guest User was auto-created - prompts a "claim your account" banner, same as booking's confirmation screen
    breadcrumbs: [{ label: "Porudžbina potvrđena", url: null }],
  };
}

export default {
  prepareCartData,
  prepareCheckoutStepData,
  prepareCheckoutPendingData,
  prepareOrderConfirmedData,
};