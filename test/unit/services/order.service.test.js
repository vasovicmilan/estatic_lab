import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import orderRepo from "../../../src/repositories/order.repository.js";
import tempOrderService from "../../../src/services/temporary-order.service.js";
import productService from "../../../src/services/product.service.js";
import userService from "../../../src/services/user.service.js";
import couponService from "../../../src/services/coupon.service.js";
import * as orderService from "../../../src/services/order.service.js";
import { buildOrder, buildOrderItem, buildTemporaryOrder, buildProduct, buildProductVariation, id } from "../../helpers/factories.js";

// createOrderFromTemporaryOrder (shared by confirmOrder/confirmOrderByAdmin) wraps
// everything in a real Mongo transaction - faking the session lets these run as pure
// unit tests instead of needing a replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

describe("order.service", () => {
  describe("getOrderById / canAccessOrder", () => {
    it("lets an admin read any order regardless of who owns it", async (t) => {
      const order = buildOrder({ user: id() });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      const result = await orderService.getOrderById(order._id.toString(), id().toString(), "admin");
      assert.equal(result.id, order._id.toString());
    });

    it("lets a user read their own order", async (t) => {
      const userId = id();
      const order = buildOrder({ user: { _id: userId } });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      const result = await orderService.getOrderById(order._id.toString(), userId.toString(), "user");
      assert.equal(result.id, order._id.toString());
    });

    it("forbids a user from reading someone else's order", async (t) => {
      const order = buildOrder({ user: { _id: id() } });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(
        () => orderService.getOrderById(order._id.toString(), id().toString(), "user"),
        (err) => err.statusCode === 403
      );
    });

    it("throws 404 for a nonexistent order", async (t) => {
      t.mock.method(orderRepo, "findOrderById", async () => null);
      await assert.rejects(() => orderService.getOrderById(id().toString(), id().toString(), "admin"), (err) => err.statusCode === 404);
    });
  });

  describe("confirmOrder", () => {
    it("creates the real order, redeems the coupon, deletes the temp order, and emits order:confirmed", async (t) => {
      mockSession(t);
      const tempOrder = buildTemporaryOrder({ coupon: id(), discountApplied: 500 });
      t.mock.method(tempOrderService, "verifyToken", async () => ({ ...tempOrder, temporaryOrderId: tempOrder._id.toString() }));

      let createdOrderPayload;
      const created = buildOrder();
      t.mock.method(orderRepo, "createOrder", async (payload) => {
        createdOrderPayload = payload;
        return created;
      });
      const redeemMock = t.mock.method(couponService, "redeemCoupon", async () => {});
      const deleteMock = t.mock.method(tempOrderService, "deleteTemporaryOrder", async () => {});
      t.mock.method(orderRepo, "findOrderById", async () => created);

      let emittedPayload;
      const handler = (payload) => { emittedPayload = payload; };
      const eventEmitter = (await import("../../../src/events/event.emitter.js")).default;
      eventEmitter.on("order:confirmed", handler);

      try {
        const result = await orderService.confirmOrder(id().toString(), "sometoken");

        assert.equal(createdOrderPayload.status, "pending");
        assert.ok(createdOrderPayload.cancelToken, "a cancelToken should be generated for the new order");
        assert.equal(redeemMock.mock.calls.length, 1, "coupon should be redeemed exactly once");
        assert.equal(deleteMock.mock.calls.length, 1, "the temporary order should be deleted after confirming");
        assert.ok(emittedPayload, "order:confirmed should have been emitted");
        assert.equal(emittedPayload.orderId, created._id.toString());
        assert.equal(result.id, created._id.toString());
      } finally {
        eventEmitter.off("order:confirmed", handler);
      }
    });

    it("does not attempt to redeem a coupon when the temp order has none", async (t) => {
      mockSession(t);
      const tempOrder = buildTemporaryOrder({ coupon: null });
      t.mock.method(tempOrderService, "verifyToken", async () => ({ ...tempOrder, temporaryOrderId: tempOrder._id.toString() }));
      const created = buildOrder();
      t.mock.method(orderRepo, "createOrder", async () => created);
      const redeemMock = t.mock.method(couponService, "redeemCoupon", async () => {});
      t.mock.method(tempOrderService, "deleteTemporaryOrder", async () => {});
      t.mock.method(orderRepo, "findOrderById", async () => created);

      await orderService.confirmOrder(id().toString(), "sometoken");

      assert.equal(redeemMock.mock.calls.length, 0);
    });

    it("refuses to confirm while requiresShippingQuote is still true - a freight item's placeholder shipping value must never be locked into a real Order", async (t) => {
      const tempOrder = buildTemporaryOrder({ requiresShippingQuote: true, shipping: 0 });
      t.mock.method(tempOrderService, "verifyToken", async () => ({ ...tempOrder, temporaryOrderId: tempOrder._id.toString() }));
      const createMock = t.mock.method(orderRepo, "createOrder", async () => buildOrder());

      await assert.rejects(
        () => orderService.confirmOrder(id().toString(), "sometoken"),
        (err) => err.statusCode === 400
      );
      assert.equal(createMock.mock.calls.length, 0, "no Order should ever be created while shipping is still unresolved");
    });
  });

  describe("confirmOrderByAdmin", () => {
    it("does not require or check a token - resolves the temp order by id alone", async (t) => {
      mockSession(t);
      const tempOrder = buildTemporaryOrder();
      const rawFetchMock = t.mock.method(tempOrderService, "getTemporaryOrderRawById", async () => tempOrder);
      const created = buildOrder();
      t.mock.method(orderRepo, "createOrder", async () => created);
      t.mock.method(tempOrderService, "deleteTemporaryOrder", async () => {});
      t.mock.method(orderRepo, "findOrderById", async () => created);

      const result = await orderService.confirmOrderByAdmin(tempOrder._id.toString(), id().toString());

      assert.equal(rawFetchMock.mock.calls.length, 1);
      assert.equal(result.id, created._id.toString());
    });

    it("refuses to confirm while requiresShippingQuote is still true - the admin path is not a bypass for this rule", async (t) => {
      const tempOrder = buildTemporaryOrder({ requiresShippingQuote: true, shipping: 0 });
      t.mock.method(tempOrderService, "getTemporaryOrderRawById", async () => tempOrder);
      const createMock = t.mock.method(orderRepo, "createOrder", async () => buildOrder());

      await assert.rejects(
        () => orderService.confirmOrderByAdmin(tempOrder._id.toString(), id().toString()),
        (err) => err.statusCode === 400
      );
      assert.equal(createMock.mock.calls.length, 0);
    });
  });

  describe("status transitions", () => {
    it("allows admin to move a pending order to processing", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      let updateData;
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        updateData = data;
        return { ...order, ...data };
      });

      await orderService.markProcessing(order._id.toString(), id().toString());

      assert.equal(updateData.status, "processing");
      assert.ok(updateData.processingAt instanceof Date);
    });

    it("rejects an invalid transition (pending straight to shipped)", async (t) => {
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(() => orderService.markShipped(order._id.toString(), id().toString()), (err) => err.statusCode === 400);
    });

    it("rejects transitioning out of a terminal 'completed' status", async (t) => {
      const order = buildOrder({ status: "completed" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(() => orderService.markProcessing(order._id.toString(), id().toString()), (err) => err.statusCode === 400);
    });

    it("restores stock for every item when an order is cancelled", async (t) => {
      mockSession(t);
      const items = [buildOrderItem({ quantity: 2 }), buildOrderItem({ quantity: 1 })];
      const order = buildOrder({ status: "pending", items });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.cancelOrder(order._id.toString(), "Predomislio se", id().toString(), "admin");

      assert.equal(restoreMock.mock.calls.length, 2, "stock should be restored once per item");
    });

    it("restores stock when an order is returned too, not just cancelled", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "shipped", items: [buildOrderItem()] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.markReturned(order._id.toString(), "Neispravan proizvod", id().toString());

      assert.equal(restoreMock.mock.calls.length, 1);
    });

    it("does NOT restore stock for a normal (non-cancel/return) transition", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "pending", items: [buildOrderItem()] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.markProcessing(order._id.toString(), id().toString());

      assert.equal(restoreMock.mock.calls.length, 0);
    });

    it("emits order:status_changed with the previous and new status", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));

      let emittedPayload;
      const handler = (payload) => { emittedPayload = payload; };
      const eventEmitter = (await import("../../../src/events/event.emitter.js")).default;
      eventEmitter.on("order:status_changed", handler);

      try {
        await orderService.markProcessing(order._id.toString(), id().toString());
        assert.equal(emittedPayload.status, "processing");
        assert.equal(emittedPayload.previousStatus, "pending");
      } finally {
        eventEmitter.off("order:status_changed", handler);
      }
    });
  });

  describe("cancelOrder - user vs admin rules", () => {
    it("lets a user cancel their own order while still pending", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "pending" });
      let currentOrder = order;
      t.mock.method(orderRepo, "findOrderById", async () => currentOrder);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        currentOrder = { ...currentOrder, ...data };
        return currentOrder;
      });
      t.mock.method(productService, "restoreVariationStock", async () => {});

      const result = await orderService.cancelOrder(order._id.toString(), "Predomislio se", String(order.user._id), "user");
      assert.equal(result.status, "Otkazano");
    });

    it("blocks a user from cancelling once processing has started", async (t) => {
      const order = buildOrder({ status: "processing" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(
        () => orderService.cancelOrder(order._id.toString(), "Predomislio se", String(order.user._id), "user"),
        (err) => err.statusCode === 400
      );
    });

    it("lets an admin cancel an order that's already processing (no canUserCancelOrder check applies to admin)", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "processing" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      t.mock.method(productService, "restoreVariationStock", async () => {});

      // should NOT throw
      await orderService.cancelOrder(order._id.toString(), "Van na stanju", id().toString(), "admin");
    });

    it("records cancelledBy correctly for a user-initiated cancellation", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      let updateData;
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        updateData = data;
        return { ...order, ...data };
      });
      t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.cancelOrder(order._id.toString(), "", String(order.user._id), "user");

      assert.equal(updateData.cancelledBy, "user");
    });
  });

  describe("reopenOrder", () => {
    it("allows admin to reopen a cancelled order back to pending, re-claiming the stock that was given back on cancellation", async (t) => {
      mockSession(t);
      const item = buildOrderItem({ quantity: 2 });
      const order = buildOrder({ status: "cancelled", items: [item] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      let updateData;
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        updateData = data;
        return { ...order, ...data };
      });
      // BUG FIX regression test - see transitionStatus's own comment in
      // order.service.js. Reopening used to have no stock effect at all, so a
      // later re-cancellation of the same reopened order would restore stock a
      // second time for the same original decrement.
      const decreaseMock = t.mock.method(productService, "decreaseVariationStock", async () => {});

      await orderService.reopenOrder(order._id.toString(), id().toString());

      assert.equal(updateData.status, "pending");
      assert.equal(decreaseMock.mock.calls.length, 1);
      assert.equal(String(decreaseMock.mock.calls[0].arguments[0]), String(item.product));
      assert.equal(String(decreaseMock.mock.calls[0].arguments[1]), String(item.variant));
      assert.equal(decreaseMock.mock.calls[0].arguments[2], item.quantity);
    });

    it("aborts the reopen (order stays cancelled) when the stock is no longer available to re-claim", async (t) => {
      mockSession(t);
      const order = buildOrder({ status: "cancelled", items: [buildOrderItem({ quantity: 5 })] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      const updateMock = t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      t.mock.method(productService, "decreaseVariationStock", async () => {
        const err = new Error("Nema dovoljno zaliha");
        err.statusCode = 400;
        throw err;
      });

      await assert.rejects(() => orderService.reopenOrder(order._id.toString(), id().toString()));
      // the order's own status must never be updated if re-claiming stock failed -
      // a "pending" order the business can't actually fulfill is exactly the
      // broken state this fix exists to prevent
      assert.equal(updateMock.mock.calls.length, 0);
    });

    it("cannot reopen an order that was never cancelled", async (t) => {
      const order = buildOrder({ status: "delivered" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(() => orderService.reopenOrder(order._id.toString(), id().toString()), (err) => err.statusCode === 400);
    });
  });

  describe("updateOrderContactInfo", () => {
    it("rejects editing contact info once the order has shipped", async (t) => {
      const order = buildOrder({ status: "shipped" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(
        () => orderService.updateOrderContactInfo(order._id.toString(), { phone: "0601234567" }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an incomplete address (missing street)", async (t) => {
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(
        () => orderService.updateOrderContactInfo(order._id.toString(), { address: { city: "Novi Sad", postalCode: "21000", number: "5" } }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects when neither phone nor address is provided", async (t) => {
      const order = buildOrder({ status: "pending" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      await assert.rejects(() => orderService.updateOrderContactInfo(order._id.toString(), {}), (err) => err.statusCode === 400);
    });

    it("updates the phone when a complete, valid payload is given", async (t) => {
      const order = buildOrder({ status: "processing" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      let updateData;
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        updateData = data;
        return { ...order, ...data };
      });

      await orderService.updateOrderContactInfo(order._id.toString(), { phone: "0601234567" });

      assert.ok(updateData.phone, "phone should be present in the update (encrypted record)");
    });
  });

  describe("createManualOrder", () => {
    // Builds what decreaseVariationStock would normally return - a real Mongoose
    // document has variations.id(variantId) (subdocument array lookup by _id);
    // this fakes just enough of that surface for createManualOrder's own
    // `product.variations.id(variantId)` call right after.
    function buildProductWithVariation(variationOverrides = {}) {
      const variation = buildProductVariation(variationOverrides);
      const product = buildProduct({ variations: [variation] });
      product.variations.id = (vid) => product.variations.find((v) => String(v._id) === String(vid));
      return { product, variation };
    }

    // BUG FIX regression tests - see this function's own comment in
    // order.service.js. price used to store lineTotal (unitPrice * quantity)
    // while a normal checkout stores the plain unit price in the same field -
    // order.mapper.js's `ukupno: item.price * item.quantity` assumes the
    // latter for every order, so a manual order with quantity > 1 displayed a
    // per-item total re-multiplied by quantity a second time.
    it("stores the unit price in items[0].price, NOT price*quantity, matching a normal checkout's semantics", async (t) => {
      mockSession(t);
      const { product, variation } = buildProductWithVariation({ price: 2000 });
      t.mock.method(productService, "decreaseVariationStock", async () => product);
      t.mock.method(userService, "findUserByEmail", async () => null);
      t.mock.method(userService, "createGuestUser", async () => ({ _id: id() }));
      let created;
      t.mock.method(orderRepo, "createOrder", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(orderRepo, "findOrderById", async () => created);

      await orderService.createManualOrder(
        {
          items: [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 3 }],
          contact: { firstName: "Ana", email: "ana@example.com" },
          phone: "0601234567",
          address: { city: "Novi Sad", street: "Bulevar", number: "5", postalCode: "21000" },
        },
        { actorId: id().toString(), actorRole: "admin" }
      );

      assert.equal(created.items[0].price, 2000, "price must be the unit price (2000), not 2000*3=6000");
      assert.equal(created.items[0].quantity, 3);
      assert.equal(created.subtotal, 6000, "the order's own subtotal is where the multiplication belongs, not the line item's price field");
    });

    it("uses priceOverride as the unit price when given, still not pre-multiplied by quantity", async (t) => {
      mockSession(t);
      const { product, variation } = buildProductWithVariation({ price: 2000 });
      t.mock.method(productService, "decreaseVariationStock", async () => product);
      t.mock.method(userService, "findUserByEmail", async () => null);
      t.mock.method(userService, "createGuestUser", async () => ({ _id: id() }));
      let created;
      t.mock.method(orderRepo, "createOrder", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(orderRepo, "findOrderById", async () => created);

      await orderService.createManualOrder(
        {
          items: [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 2, priceOverride: 1500 }],
          contact: { firstName: "Ana", email: "ana@example.com" },
          phone: "0601234567",
          address: { city: "Novi Sad", street: "Bulevar", number: "5", postalCode: "21000" },
        },
        { actorId: id().toString(), actorRole: "admin" }
      );

      assert.equal(created.items[0].price, 1500);
      assert.equal(created.subtotal, 3000);
    });

    it("requires an explicit priceOverride for a priceOnRequest product, refusing to silently fall back to its internal reference price", async (t) => {
      mockSession(t);
      const { product, variation } = buildProductWithVariation();
      product.priceOnRequest = true;
      t.mock.method(productService, "decreaseVariationStock", async () => product);
      t.mock.method(userService, "findUserByEmail", async () => null);
      t.mock.method(userService, "createGuestUser", async () => ({ _id: id() }));

      await assert.rejects(
        () =>
          orderService.createManualOrder(
            {
              items: [{ productId: product._id.toString(), variantId: variation._id.toString(), quantity: 1 }],
              contact: { firstName: "Ana", email: "ana@example.com" },
              phone: "0601234567",
              address: { city: "Novi Sad", street: "Bulevar", number: "5", postalCode: "21000" },
            },
            { actorId: id().toString(), actorRole: "admin" }
          ),
        (err) => err.statusCode === 400
      );
    });
  });
});