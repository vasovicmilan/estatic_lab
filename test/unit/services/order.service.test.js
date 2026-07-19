import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import orderRepo from "../../../src/repositories/order.repository.js";
import tempOrderService from "../../../src/services/temporary-order.service.js";
import productService from "../../../src/services/product.service.js";
import couponService from "../../../src/services/coupon.service.js";
import * as orderService from "../../../src/services/order.service.js";
import { buildOrder, buildOrderItem, buildTemporaryOrder, id } from "../../helpers/factories.js";

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
  });

  describe("status transitions", () => {
    it("allows admin to move a pending order to processing", async (t) => {
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
      const items = [buildOrderItem({ quantity: 2 }), buildOrderItem({ quantity: 1 })];
      const order = buildOrder({ status: "pending", items });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.cancelOrder(order._id.toString(), "Predomislio se", id().toString(), "admin");

      assert.equal(restoreMock.mock.calls.length, 2, "stock should be restored once per item");
    });

    it("restores stock when an order is returned too, not just cancelled", async (t) => {
      const order = buildOrder({ status: "shipped", items: [buildOrderItem()] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.markReturned(order._id.toString(), "Neispravan proizvod", id().toString());

      assert.equal(restoreMock.mock.calls.length, 1);
    });

    it("does NOT restore stock for a normal (non-cancel/return) transition", async (t) => {
      const order = buildOrder({ status: "pending", items: [buildOrderItem()] });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      const restoreMock = t.mock.method(productService, "restoreVariationStock", async () => {});

      await orderService.markProcessing(order._id.toString(), id().toString());

      assert.equal(restoreMock.mock.calls.length, 0);
    });

    it("emits order:status_changed with the previous and new status", async (t) => {
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
      const order = buildOrder({ status: "processing" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => ({ ...order, ...data }));
      t.mock.method(productService, "restoreVariationStock", async () => {});

      // should NOT throw
      await orderService.cancelOrder(order._id.toString(), "Van na stanju", id().toString(), "admin");
    });

    it("records cancelledBy correctly for a user-initiated cancellation", async (t) => {
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
    it("allows admin to reopen a cancelled order back to pending", async (t) => {
      const order = buildOrder({ status: "cancelled" });
      t.mock.method(orderRepo, "findOrderById", async () => order);
      let updateData;
      t.mock.method(orderRepo, "updateOrderById", async (id_, data) => {
        updateData = data;
        return { ...order, ...data };
      });

      await orderService.reopenOrder(order._id.toString(), id().toString());
      assert.equal(updateData.status, "pending");
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
});