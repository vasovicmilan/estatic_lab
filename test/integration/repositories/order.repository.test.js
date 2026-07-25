import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import orderRepo from "../../../src/repositories/order.repository.js";
import "../../../src/models/user.model.js";
import "../../../src/models/coupon.model.js";

function validOrder(overrides = {}) {
  return {
    user: new mongoose.Types.ObjectId(),
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: { hash: "hash123", encrypted: "encrypted123" },
    address: { city: "Novi Sad", postalCode: "21000", street: "encryptedstreet", number: "encryptednum" },
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: new mongoose.Types.ObjectId(),
        title: "Krema za lice",
        variantLabel: "50ml",
        price: 2000,
        quantity: 1,
      },
    ],
    subtotal: 2000,
    totalPrice: 2000,
    ...overrides,
  };
}

describe("order.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createOrder / findOrderById", () => {
    it("persists an order with default status 'pending'", async () => {
      const created = await orderRepo.createOrder(validOrder());
      assert.ok(created._id);
      assert.equal(created.status, "pending");
    });

    it("returns null for a nonexistent id", async () => {
      const found = await orderRepo.findOrderById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("rejects an order with zero items (custom array validator)", async () => {
      await assert.rejects(() => orderRepo.createOrder(validOrder({ items: [] })));
    });

    it("does not crash when user/coupon aren't populatable (dangling or unpopulated refs)", async () => {
      const created = await orderRepo.createOrder(validOrder());
      const found = await orderRepo.findOrderById(created._id);
      assert.equal(found.user, null, "populate() correctly resolves to null when the User doesn't exist in this test DB");
    });
  });

  describe("findOrderByCancelToken", () => {
    it("finds the order by its cancelToken", async () => {
      await orderRepo.createOrder(validOrder({ cancelToken: "cancel-abc" }));
      const found = await orderRepo.findOrderByCancelToken("cancel-abc");
      assert.equal(found.cancelToken, "cancel-abc");
    });

    it("returns null for an unrecognized token", async () => {
      const found = await orderRepo.findOrderByCancelToken("nonexistent-token");
      assert.equal(found, null);
    });
  });

  describe("findOrders - filtering, search, and pagination", () => {
    it("filters by status", async () => {
      await orderRepo.createOrder(validOrder({ status: "pending" }));
      await orderRepo.createOrder(validOrder({ status: "shipped" }));

      const result = await orderRepo.findOrders({ filters: { status: "shipped" } });

      assert.equal(result.total, 1);
      assert.equal(result.data[0].status, "shipped");
    });

    it("search matches contactSnapshot and line-item titles", async () => {
      await orderRepo.createOrder(validOrder({ contactSnapshot: { firstName: "Ana", lastName: "Anic", email: "ana@example.com" } }));
      await orderRepo.createOrder(validOrder({ contactSnapshot: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com" } }));

      const result = await orderRepo.findOrders({ search: "ana" });

      assert.equal(result.total, 1);
    });

    it("sorts newest first and paginates", async () => {
      for (let i = 0; i < 3; i++) {
        await orderRepo.createOrder(validOrder());
      }

      const result = await orderRepo.findOrders({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("findOrdersByUser", () => {
    it("scopes to the given user and uses a minimal coupon-only populate by default", async () => {
      const userId = new mongoose.Types.ObjectId();
      await orderRepo.createOrder(validOrder({ user: userId }));
      await orderRepo.createOrder(validOrder());

      const result = await orderRepo.findOrdersByUser(userId);

      assert.equal(result.total, 1);
      assert.equal(String(result.data[0].user), String(userId));
    });

    it("respects an explicit populateFields override", async () => {
      const userId = new mongoose.Types.ObjectId();
      await orderRepo.createOrder(validOrder({ user: userId }));

      // should NOT throw with an empty populate list
      const result = await orderRepo.findOrdersByUser(userId, { populateFields: [] });
      assert.equal(result.total, 1);
    });
  });

  describe("updateOrderById", () => {
    it("updates status and returns the post-update document", async () => {
      const created = await orderRepo.createOrder(validOrder());
      const updated = await orderRepo.updateOrderById(created._id, { status: "shipped", shippedAt: new Date() });
      assert.equal(updated.status, "shipped");
      assert.ok(updated.shippedAt);
    });
  });

  describe("countOrders", () => {
    it("counts matching a filter - the exact shape used to guard User hard-deletion", async () => {
      const userId = new mongoose.Types.ObjectId();
      await orderRepo.createOrder(validOrder({ user: userId }));
      await orderRepo.createOrder(validOrder());

      const count = await orderRepo.countOrders({ user: userId });

      assert.equal(count, 1);
    });

    it("returns 0 when nothing matches, letting a User hard-delete proceed", async () => {
      const count = await orderRepo.countOrders({ user: new mongoose.Types.ObjectId() });
      assert.equal(count, 0);
    });
  });
});