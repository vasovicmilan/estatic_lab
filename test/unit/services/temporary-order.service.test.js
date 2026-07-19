import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import tempOrderRepo from "../../../src/repositories/temporary-order.repository.js";
import userService from "../../../src/services/user.service.js";
import productService from "../../../src/services/product.service.js";
import couponService from "../../../src/services/coupon.service.js";
import * as tempOrderService from "../../../src/services/temporary-order.service.js";
import { buildTemporaryOrder, buildOrderItem, buildProductVariation, id } from "../../helpers/factories.js";

function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

function validInput(overrides = {}) {
  return {
    items: [{ productId: id().toString(), variantId: id().toString(), quantity: 1 }],
    isLoggedIn: false,
    contact: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: "0601234567",
    address: { city: "Novi Sad", postalCode: "21000", street: "Bulevar", number: "10" },
    ...overrides,
  };
}

// decreaseVariationStock returns a Mongoose-doc-like product with variations.id() -
// same fake shape used in product.service.test.js
function fakeProductWithVariation(variation) {
  return {
    _id: id(),
    name: "ESMA Uređaj",
    sku: "esma-001",
    image: null,
    variations: { id: (vid) => (String(vid) === String(variation._id) ? variation : null) },
  };
}

describe("temporary-order.service", () => {
  describe("createTemporaryOrder - validation", () => {
    it("rejects an empty cart", async () => {
      await assert.rejects(() => tempOrderService.createTemporaryOrder(validInput({ items: [] })), (err) => err.statusCode === 400);
    });

    it("rejects a missing email", async () => {
      await assert.rejects(
        () => tempOrderService.createTemporaryOrder(validInput({ contact: { firstName: "Marko" } })),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a missing phone", async () => {
      await assert.rejects(() => tempOrderService.createTemporaryOrder(validInput({ phone: undefined })), (err) => err.statusCode === 400);
    });

    it("rejects an incomplete address", async () => {
      await assert.rejects(
        () => tempOrderService.createTemporaryOrder(validInput({ address: { city: "Novi Sad" } })),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createTemporaryOrder - buyer resolution", () => {
    it("uses the logged-in user's id directly, without checking by email", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 2000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      const userId = id();
      const findByIdMock = t.mock.method(userService, "findUserById", async () => ({ _id: userId }));
      const findByEmailMock = t.mock.method(userService, "findUserByEmail", async () => null);
      t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => ({ ...buildTemporaryOrder(), ...data, _id: id() }));

      await tempOrderService.createTemporaryOrder(
        validInput({
          isLoggedIn: true,
          userId: userId.toString(),
          items: [{ productId: id().toString(), variantId: variation._id.toString(), quantity: 1 }],
        })
      );

      assert.equal(findByIdMock.mock.calls.length, 1);
      assert.equal(findByEmailMock.mock.calls.length, 0, "a logged-in checkout shouldn't need an email lookup at all");
    });

    it("attaches the order to an existing account found by email (guest checkout, but the email is already registered)", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 2000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      const existingUserId = id();
      t.mock.method(userService, "findUserByEmail", async () => ({ _id: existingUserId }));
      const createGuestMock = t.mock.method(userService, "createGuestUser", async () => ({ _id: id() }));
      t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      let createdPayload;
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => {
        createdPayload = data;
        return { ...buildTemporaryOrder(), ...data, _id: id() };
      });

      await tempOrderService.createTemporaryOrder(
        validInput({ items: [{ productId: id().toString(), variantId: variation._id.toString(), quantity: 1 }] })
      );

      assert.equal(createGuestMock.mock.calls.length, 0, "no new account should be created for an already-registered email");
      assert.equal(String(createdPayload.user), String(existingUserId));
    });

    it("creates a guest account when the email isn't registered, and emits user:guest_created", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 2000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      t.mock.method(userService, "findUserByEmail", async () => null);
      const newGuestId = id();
      t.mock.method(userService, "createGuestUser", async () => ({ _id: newGuestId }));
      t.mock.method(userService, "findUserById", async () => ({ _id: newGuestId, email: "marko@example.com", firstName: "Marko", resetToken: "reset123" }));
      t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => ({ ...buildTemporaryOrder(), ...data, _id: id() }));

      const eventEmitter = (await import("../../../src/events/event.emitter.js")).default;
      let guestCreatedPayload;
      const handler = (payload) => { guestCreatedPayload = payload; };
      eventEmitter.on("user:guest_created", handler);

      try {
        const result = await tempOrderService.createTemporaryOrder(
          validInput({ items: [{ productId: id().toString(), variantId: variation._id.toString(), quantity: 1 }] })
        );
        assert.equal(result.accountJustCreated, true);
        assert.ok(guestCreatedPayload, "user:guest_created should have fired");
        assert.equal(guestCreatedPayload.email, "marko@example.com");
      } finally {
        eventEmitter.off("user:guest_created", handler);
      }
    });
  });

  describe("createTemporaryOrder - pricing, stock, and coupons", () => {
    it("sums variation price * quantity into subtotal across multiple items", async (t) => {
      mockSession(t);
      const variationA = buildProductVariation({ price: 1000 });
      const variationB = buildProductVariation({ price: 500 });
      let call = 0;
      t.mock.method(productService, "getVariationRaw", async () => (call++ === 0 ? { variation: variationA } : { variation: variationB }));
      t.mock.method(userService, "findUserByEmail", async () => ({ _id: id() }));
      let decreaseCall = 0;
      t.mock.method(productService, "decreaseVariationStock", async () =>
        fakeProductWithVariation(decreaseCall++ === 0 ? variationA : variationB)
      );
      let createdPayload;
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => {
        createdPayload = data;
        return { ...buildTemporaryOrder(), ...data, _id: id() };
      });

      await tempOrderService.createTemporaryOrder(
        validInput({
          items: [
            { productId: id().toString(), variantId: variationA._id.toString(), quantity: 2 }, // 2000
            { productId: id().toString(), variantId: variationB._id.toString(), quantity: 3 }, // 1500
          ],
        })
      );

      assert.equal(createdPayload.subtotal, 3500);
    });

    it("reserves stock once per item via decreaseVariationStock", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 1000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      t.mock.method(userService, "findUserByEmail", async () => ({ _id: id() }));
      const decreaseMock = t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => ({ ...buildTemporaryOrder(), ...data, _id: id() }));

      await tempOrderService.createTemporaryOrder(
        validInput({
          items: [
            { productId: id().toString(), variantId: variation._id.toString(), quantity: 1 },
            { productId: id().toString(), variantId: variation._id.toString(), quantity: 1 },
          ],
        })
      );

      assert.equal(decreaseMock.mock.calls.length, 2);
    });

    it("applies a valid coupon's discount and stores the coupon id", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 2000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      t.mock.method(userService, "findUserByEmail", async () => ({ _id: id() }));
      t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      const couponId = id();
      t.mock.method(couponService, "validateCouponForOrder", async () => ({ coupon: { _id: couponId }, discountAmount: 300 }));
      let createdPayload;
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => {
        createdPayload = data;
        return { ...buildTemporaryOrder(), ...data, _id: id() };
      });

      await tempOrderService.createTemporaryOrder(
        validInput({
          couponCode: "LETO10",
          items: [{ productId: id().toString(), variantId: variation._id.toString(), quantity: 1 }],
        })
      );

      assert.equal(createdPayload.discountApplied, 300);
      assert.equal(String(createdPayload.coupon), String(couponId));
    });

    it("does not call coupon validation at all when no code is given", async (t) => {
      mockSession(t);
      const variation = buildProductVariation({ price: 2000 });
      t.mock.method(productService, "getVariationRaw", async () => ({ variation }));
      t.mock.method(userService, "findUserByEmail", async () => ({ _id: id() }));
      t.mock.method(productService, "decreaseVariationStock", async () => fakeProductWithVariation(variation));
      const validateMock = t.mock.method(couponService, "validateCouponForOrder", async () => ({}));
      t.mock.method(tempOrderRepo, "createTemporaryOrder", async (data) => ({ ...buildTemporaryOrder(), ...data, _id: id() }));

      await tempOrderService.createTemporaryOrder(
        validInput({
          couponCode: null,
          items: [{ productId: id().toString(), variantId: variation._id.toString(), quantity: 1 }],
        })
      );

      assert.equal(validateMock.mock.calls.length, 0);
    });
  });

  describe("verifyToken", () => {
    it("rejects a token that doesn't match", async (t) => {
      const order = buildTemporaryOrder({ verificationToken: "correct-token" });
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => order);
      await assert.rejects(
        () => tempOrderService.verifyToken(order._id.toString(), "wrong-token"),
        (err) => err.statusCode === 401
      );
    });

    it("rejects an expired token by default", async (t) => {
      const order = buildTemporaryOrder({ verificationToken: "tok", tokenExpiration: new Date(Date.now() - 60000) });
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => order);
      await assert.rejects(
        () => tempOrderService.verifyToken(order._id.toString(), "tok"),
        (err) => err.statusCode === 400
      );
    });

    it("accepts an expired token when ignoreExpiration is set (admin override)", async (t) => {
      const order = buildTemporaryOrder({ verificationToken: "tok", tokenExpiration: new Date(Date.now() - 60000) });
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => order);
      // should NOT throw
      await tempOrderService.verifyToken(order._id.toString(), "tok", { ignoreExpiration: true });
    });

    it("accepts a valid, unexpired token", async (t) => {
      const order = buildTemporaryOrder({ verificationToken: "tok", tokenExpiration: new Date(Date.now() + 60000) });
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => order);
      const result = await tempOrderService.verifyToken(order._id.toString(), "tok");
      assert.equal(result.temporaryOrderId, order._id.toString());
    });

    it("throws 400 for a nonexistent temporary order (not 404 - the customer shouldn't learn whether the id ever existed)", async (t) => {
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => null);
      await assert.rejects(
        () => tempOrderService.verifyToken(id().toString(), "tok"),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("cleanupExpiredTemporaryOrders", () => {
    it("restores stock for every item and deletes each expired order", async (t) => {
      mockSession(t);
      const expired = [
        buildTemporaryOrder({ items: [buildOrderItem({ quantity: 2 }), buildOrderItem({ quantity: 1 })] }),
        buildTemporaryOrder({ items: [buildOrderItem({ quantity: 3 })] }),
      ];
      t.mock.method(tempOrderRepo, "findTemporaryOrdersPastRetention", async () => expired);
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});
      const deleteMock = t.mock.method(tempOrderRepo, "deleteTemporaryOrderById", async () => ({ deletedCount: 1 }));

      const result = await tempOrderService.cleanupExpiredTemporaryOrders();

      assert.equal(restoreMock.mock.calls.length, 3, "one restore call per line item across both orders");
      assert.equal(deleteMock.mock.calls.length, 2);
      assert.equal(result.cleaned, 2);
      assert.equal(result.total, 2);
    });

    it("keeps processing remaining orders even if one fails partway through", async (t) => {
      mockSession(t);
      const expired = [buildTemporaryOrder(), buildTemporaryOrder()];
      t.mock.method(tempOrderRepo, "findTemporaryOrdersPastRetention", async () => expired);
      let call = 0;
      t.mock.method(productService, "restoreVariationStock", async () => {
        call += 1;
        if (call === 1) throw new Error("boom");
      });
      t.mock.method(tempOrderRepo, "deleteTemporaryOrderById", async () => ({ deletedCount: 1 }));

      const result = await tempOrderService.cleanupExpiredTemporaryOrders();

      assert.equal(result.total, 2);
      assert.equal(result.cleaned, 1, "the failed order shouldn't count as cleaned, but the other one still should");
    });

    it("reports zero cleaned when nothing is past retention", async (t) => {
      t.mock.method(tempOrderRepo, "findTemporaryOrdersPastRetention", async () => []);
      const result = await tempOrderService.cleanupExpiredTemporaryOrders();
      assert.equal(result.cleaned, 0);
      assert.equal(result.total, 0);
    });
  });

  describe("deleteTemporaryOrder / getTemporaryOrderRawById", () => {
    it("throws 404 when deleting a temporary order that doesn't exist", async (t) => {
      t.mock.method(tempOrderRepo, "deleteTemporaryOrderById", async () => null);
      await assert.rejects(() => tempOrderService.deleteTemporaryOrder(id().toString()), (err) => err.statusCode === 404);
    });

    it("throws 404 for a nonexistent order when fetched raw", async (t) => {
      t.mock.method(tempOrderRepo, "findTemporaryOrderById", async () => null);
      await assert.rejects(() => tempOrderService.getTemporaryOrderRawById(id().toString()), (err) => err.statusCode === 404);
    });
  });
});