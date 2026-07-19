import { describe, it } from "node:test";
import assert from "node:assert/strict";
import productService from "../../../src/services/product.service.js";
import userService from "../../../src/services/user.service.js";
import tempOrderService from "../../../src/services/temporary-order.service.js";
import orderService from "../../../src/services/order.service.js";
import * as shopService from "../../../src/services/shop.service.js";
import { buildProduct, buildProductVariation, id } from "../../helpers/factories.js";

function mockVariationLookup(t, product, variation) {
  t.mock.method(productService, "getVariationRaw", async (productId, variantId) => {
    if (String(productId) !== String(product._id) || String(variantId) !== String(variation._id)) {
      const err = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    return { product, variation };
  });
}

describe("shop.service", () => {
  describe("getCart", () => {
    it("delegates to userService.getCart for a logged-in user, ignoring any guestCart", async (t) => {
      const userId = id();
      const getCartMock = t.mock.method(userService, "getCart", async () => ({ stavke: [], brojStavki: 0, ukupnaCena: 0 }));
      await shopService.getCart({ isLoggedIn: true, userId: userId.toString(), guestCart: [{ productId: "x", variantId: "y", quantity: 1 }] });
      assert.equal(getCartMock.mock.calls.length, 1);
      assert.equal(getCartMock.mock.calls[0].arguments[0], userId.toString());
    });

    it("resolves a guest cart from the session array when not logged in", async (t) => {
      const product = buildProduct();
      const variation = product.variations[0];
      mockVariationLookup(t, product, variation);

      const cart = await shopService.getCart({
        isLoggedIn: false,
        guestCart: [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 2 }],
      });

      assert.equal(cart.stavke.length, 1);
      assert.equal(cart.stavke[0].kolicina, 2);
      assert.equal(cart.ukupnaCena, variation.price * 2);
    });

    it("silently drops a guest cart line whose product/variant no longer exists, instead of failing the whole cart", async (t) => {
      t.mock.method(productService, "getVariationRaw", async () => {
        const err = new Error("Not found");
        err.statusCode = 404;
        throw err;
      });

      const cart = await shopService.getCart({
        isLoggedIn: false,
        guestCart: [{ productId: id().toString(), variantId: id().toString(), quantity: 1 }],
      });

      assert.equal(cart.stavke.length, 0);
      assert.equal(cart.brojStavki, 0);
    });
  });

  describe("addToCart", () => {
    it("rejects a missing productId/variantId/quantity", async () => {
      await assert.rejects(() => shopService.addToCart({ variantId: "v", quantity: 1 }), (err) => err.statusCode === 400);
      await assert.rejects(() => shopService.addToCart({ productId: "p", quantity: 1 }), (err) => err.statusCode === 400);
      await assert.rejects(() => shopService.addToCart({ productId: "p", variantId: "v", quantity: 0 }), (err) => err.statusCode === 400);
    });

    it("delegates straight to userService.addToCart for a logged-in user", async (t) => {
      const userId = id();
      const addMock = t.mock.method(userService, "addToCart", async () => ({ stavke: [] }));
      const result = await shopService.addToCart({
        isLoggedIn: true,
        userId: userId.toString(),
        productId: "p1",
        variantId: "v1",
        quantity: 1,
      });
      assert.equal(addMock.mock.calls.length, 1);
      assert.deepEqual(result.guestCart, []);
    });

    it("adds a brand-new line to a guest cart", async (t) => {
      const product = buildProduct();
      const variation = product.variations[0];
      mockVariationLookup(t, product, variation);

      const { guestCart } = await shopService.addToCart({
        isLoggedIn: false,
        guestCart: [],
        productId: product._id.toString(),
        variantId: variation._id.toString(),
        quantity: 1,
      });

      assert.equal(guestCart.length, 1);
      assert.equal(guestCart[0].quantity, 1);
    });

    it("increments quantity instead of duplicating when the same product+variant is already in the guest cart", async (t) => {
      const product = buildProduct();
      const variation = product.variations[0];
      mockVariationLookup(t, product, variation);

      const existingCart = [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 2 }];
      const { guestCart } = await shopService.addToCart({
        isLoggedIn: false,
        guestCart: existingCart,
        productId: product._id.toString(),
        variantId: variation._id.toString(),
        quantity: 3,
      });

      assert.equal(guestCart.length, 1, "should merge into the existing line, not add a second one");
      assert.equal(guestCart[0].quantity, 5);
    });

    it("throws (does not add) when the variant doesn't exist or is inactive", async (t) => {
      t.mock.method(productService, "getVariationRaw", async () => {
        const err = new Error("Not found");
        err.statusCode = 404;
        throw err;
      });
      await assert.rejects(
        () => shopService.addToCart({ isLoggedIn: false, guestCart: [], productId: "p", variantId: "v", quantity: 1 }),
        (err) => err.statusCode === 404
      );
    });
  });

  describe("updateCartItemQuantity", () => {
    it("rejects a missing quantity", async () => {
      await assert.rejects(() => shopService.updateCartItemQuantity({ productId: "p", variantId: "v" }), (err) => err.statusCode === 400);
    });

    it("requires cartItemId for a logged-in user", async () => {
      await assert.rejects(
        () => shopService.updateCartItemQuantity({ isLoggedIn: true, userId: id().toString(), quantity: 2 }),
        (err) => err.statusCode === 400
      );
    });

    it("delegates to userService.updateCartItemQuantity for a logged-in user", async (t) => {
      const updateMock = t.mock.method(userService, "updateCartItemQuantity", async () => ({ stavke: [] }));
      await shopService.updateCartItemQuantity({ isLoggedIn: true, userId: id().toString(), cartItemId: id().toString(), quantity: 3 });
      assert.equal(updateMock.mock.calls.length, 1);
    });

    it("removes the guest cart line entirely when quantity is set to 0", async (t) => {
      const product = buildProduct();
      const variation = product.variations[0];
      const existingCart = [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 2 }];

      const { guestCart } = await shopService.updateCartItemQuantity({
        isLoggedIn: false,
        guestCart: existingCart,
        productId: product._id.toString(),
        variantId: variation._id.toString(),
        quantity: 0,
      });

      assert.equal(guestCart.length, 0);
    });

    it("updates the guest cart line's quantity when positive", async (t) => {
      const product = buildProduct();
      const variation = product.variations[0];
      mockVariationLookup(t, product, variation);
      const existingCart = [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 2 }];

      const { guestCart } = await shopService.updateCartItemQuantity({
        isLoggedIn: false,
        guestCart: existingCart,
        productId: product._id.toString(),
        variantId: variation._id.toString(),
        quantity: 5,
      });

      assert.equal(guestCart[0].quantity, 5);
    });
  });

  describe("removeFromCart", () => {
    it("requires cartItemId for a logged-in user", async () => {
      await assert.rejects(() => shopService.removeFromCart({ isLoggedIn: true, userId: id().toString() }), (err) => err.statusCode === 400);
    });

    it("delegates to userService.removeFromCart for a logged-in user", async (t) => {
      const removeMock = t.mock.method(userService, "removeFromCart", async () => ({ stavke: [] }));
      await shopService.removeFromCart({ isLoggedIn: true, userId: id().toString(), cartItemId: id().toString() });
      assert.equal(removeMock.mock.calls.length, 1);
    });

    it("removes the matching line from a guest cart", async (t) => {
      const remainingProduct = buildProduct();
      const remainingVariation = remainingProduct.variations[0];
      mockVariationLookup(t, remainingProduct, remainingVariation);

      const productId = id().toString();
      const variantId = id().toString();
      const existingCart = [
        { productId, variantId, quantity: 1 },
        { productId: remainingProduct._id.toString(), variantId: remainingVariation._id.toString(), quantity: 1 },
      ];

      const { guestCart } = await shopService.removeFromCart({ isLoggedIn: false, guestCart: existingCart, productId, variantId });

      assert.equal(guestCart.length, 1, "only the matching line should be removed");
    });
  });

  describe("checkout", () => {
    it("rejects checkout with an empty logged-in cart", async (t) => {
      t.mock.method(userService, "getCart", async () => ({ stavke: [] }));
      await assert.rejects(
        () => shopService.checkout({ isLoggedIn: true, userId: id().toString() }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects checkout with an empty guest cart", async () => {
      await assert.rejects(() => shopService.checkout({ isLoggedIn: false, guestCart: [] }), (err) => err.statusCode === 400);
    });

    it("builds items from the logged-in user's cart and clears it after a successful checkout", async (t) => {
      const productId = id().toString();
      const variantId = id().toString();
      t.mock.method(userService, "getCart", async () => ({
        stavke: [{ productId, variantId, kolicina: 2 }],
      }));
      let tempOrderInput;
      t.mock.method(tempOrderService, "createTemporaryOrder", async (input) => {
        tempOrderInput = input;
        return { id: id().toString() };
      });
      const clearMock = t.mock.method(userService, "clearCart", async () => {});

      await shopService.checkout({ isLoggedIn: true, userId: id().toString(), contact: {}, phone: "0601234567", address: {} });

      assert.equal(tempOrderInput.items.length, 1);
      assert.equal(tempOrderInput.items[0].quantity, 2);
      assert.equal(clearMock.mock.calls.length, 1);
    });

    it("builds items from the guest cart and does NOT try to clear any cart (nothing to clear server-side)", async (t) => {
      const productId = id().toString();
      const variantId = id().toString();
      let tempOrderInput;
      t.mock.method(tempOrderService, "createTemporaryOrder", async (input) => {
        tempOrderInput = input;
        return { id: id().toString() };
      });
      const clearMock = t.mock.method(userService, "clearCart", async () => {});

      await shopService.checkout({
        isLoggedIn: false,
        guestCart: [{ productId, variantId, quantity: 1 }],
        contact: {},
        phone: "0601234567",
        address: {},
      });

      assert.equal(tempOrderInput.items.length, 1);
      assert.equal(clearMock.mock.calls.length, 0);
    });
  });

  describe("confirmOrder", () => {
    it("delegates straight through to orderService.confirmOrder", async (t) => {
      const confirmMock = t.mock.method(orderService, "confirmOrder", async () => ({ id: "order1" }));
      await shopService.confirmOrder("order1", "token1");
      assert.equal(confirmMock.mock.calls.length, 1);
      assert.deepEqual(confirmMock.mock.calls[0].arguments, ["order1", "token1"]);
    });
  });
});