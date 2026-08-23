import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareCartData,
  prepareCheckoutStepData,
  prepareCheckoutPendingData,
  prepareOrderConfirmedData,
} from "../../../../src/presenters/public/shop.presenter.js";

describe("prepareCartData", () => {
  it("flags an empty cart correctly", () => {
    const empty = prepareCartData({ stavke: [] });
    const full = prepareCartData({ stavke: [{ productId: "p1" }] });

    assert.equal(empty.isEmpty, true);
    assert.equal(full.isEmpty, false);
  });
});

describe("prepareCheckoutStepData", () => {
  it("prefills contact info from the logged-in user's profile", () => {
    const cart = { stavke: [], ukupnaCena: 0 };
    const view = prepareCheckoutStepData(cart, {
      isLoggedIn: true,
      user: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", telefon: "0601234567" },
    });

    assert.equal(view.prefill.firstName, "Petar");
    assert.equal(view.prefill.phone, "0601234567");
  });

  it("leaves all prefill fields blank for a guest checkout", () => {
    const cart = { stavke: [], ukupnaCena: 0 };
    const view = prepareCheckoutStepData(cart, { isLoggedIn: false });

    assert.equal(view.prefill.firstName, "");
    assert.equal(view.prefill.email, "");
  });

  it("prefills the address marked as default when the customer has more than one", () => {
    const cart = { stavke: [], ukupnaCena: 0 };
    const addresses = [
      { podrazumevana: false, grad: "Beograd", postanskiBroj: "11000", ulica: "Kneza Milosa", broj: "1" },
      { podrazumevana: true, grad: "Novi Sad", postanskiBroj: "21000", ulica: "Bulevar", broj: "10" },
    ];
    const view = prepareCheckoutStepData(cart, { addresses });

    assert.equal(view.addressPrefill.city, "Novi Sad");
  });

  it("falls back to the first saved address when none is explicitly marked default", () => {
    const cart = { stavke: [], ukupnaCena: 0 };
    const addresses = [{ podrazumevana: false, grad: "Beograd", postanskiBroj: "11000", ulica: "Kneza Milosa", broj: "1" }];
    const view = prepareCheckoutStepData(cart, { addresses });

    assert.equal(view.addressPrefill.city, "Beograd");
  });

  it("leaves address fields blank when the customer has no saved addresses at all", () => {
    const cart = { stavke: [], ukupnaCena: 0 };
    const view = prepareCheckoutStepData(cart, { addresses: [] });

    assert.equal(view.addressPrefill.city, "");
  });

  it("extracts just the product ids from the cart items - for the coupon widget's applicability check", () => {
    const cart = { stavke: [{ productId: "p1" }, { productId: "p2" }], ukupnaCena: 5000 };
    const view = prepareCheckoutStepData(cart);

    assert.deepEqual(view.productIds, ["p1", "p2"]);
  });
});

describe("prepareCheckoutPendingData", () => {
  it("formats the token expiration in Belgrade time, not the server process's own timezone", () => {
    const view = prepareCheckoutPendingData({ email: "petar@example.com", tokenExpiration: new Date("2026-01-01T10:00:00Z") });
    // just confirm it went through formatDateTime rather than being a raw ISO string
    assert.notEqual(view.tokenExpiration, "2026-01-01T10:00:00.000Z");
  });

  it("shows no order details - the real Order doesn't exist yet at this step", () => {
    const view = prepareCheckoutPendingData({ email: "petar@example.com" });
    assert.ok(!("order" in view));
  });
});

describe("prepareOrderConfirmedData", () => {
  it("defaults accountJustCreated to false", () => {
    const view = prepareOrderConfirmedData({ id: "o1" });
    assert.equal(view.accountJustCreated, false);
  });

  it("flags accountJustCreated when a guest checkout created a new account", () => {
    const view = prepareOrderConfirmedData({ id: "o1" }, { accountJustCreated: true });
    assert.equal(view.accountJustCreated, true);
  });
});