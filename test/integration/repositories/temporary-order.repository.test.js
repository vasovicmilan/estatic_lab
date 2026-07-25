import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import temporaryOrderRepo from "../../../src/repositories/temporary-order.repository.js";

function validTemporaryOrder(overrides = {}) {
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
    shipping: 300,
    totalPrice: 2300,
    verificationToken: `token-${new mongoose.Types.ObjectId()}`,
    tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

describe("temporary-order.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createTemporaryOrder / findTemporaryOrderById", () => {
    it("persists a temporary order", async () => {
      const created = await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder());
      assert.ok(created._id);
      assert.equal(created.totalPrice, 2300);
    });

    it("returns null for a nonexistent id", async () => {
      const found = await temporaryOrderRepo.findTemporaryOrderById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("rejects an order with zero items (custom array validator)", async () => {
      await assert.rejects(() => temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ items: [] })));
    });

    it("rejects an order missing the required verificationToken", async () => {
      const { verificationToken, ...withoutToken } = validTemporaryOrder();
      await assert.rejects(() => temporaryOrderRepo.createTemporaryOrder(withoutToken));
    });
  });

  describe("findTemporaryOrderByToken", () => {
    it("finds the order by its verification token", async () => {
      const token = `token-${new mongoose.Types.ObjectId()}`;
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ verificationToken: token }));
      const found = await temporaryOrderRepo.findTemporaryOrderByToken(token);
      assert.equal(found.verificationToken, token);
    });

    it("returns null for an unrecognized token", async () => {
      const found = await temporaryOrderRepo.findTemporaryOrderByToken("nonexistent-token");
      assert.equal(found, null);
    });
  });

  describe("findTemporaryOrders - filtering, search, and pagination", () => {
    it("filters by user", async () => {
      const userId = new mongoose.Types.ObjectId();
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ user: userId }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder());

      const result = await temporaryOrderRepo.findTemporaryOrders({ filters: { user: userId } });

      assert.equal(result.total, 1);
      assert.equal(String(result.data[0].user), String(userId));
    });

    it("filters by expired:true (tokenExpiration in the past)", async () => {
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: new Date(Date.now() - 60 * 60 * 1000) }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: new Date(Date.now() + 60 * 60 * 1000) }));

      const result = await temporaryOrderRepo.findTemporaryOrders({ filters: { expired: true } });

      assert.equal(result.total, 1);
    });

    it("filters by expired:false (tokenExpiration still in the future)", async () => {
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: new Date(Date.now() - 60 * 60 * 1000) }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: new Date(Date.now() + 60 * 60 * 1000) }));

      const result = await temporaryOrderRepo.findTemporaryOrders({ filters: { expired: false } });

      assert.equal(result.total, 1);
    });

    it("search matches contactSnapshot firstName/lastName/email", async () => {
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ contactSnapshot: { firstName: "Ana", lastName: "Anic", email: "ana@example.com" } }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ contactSnapshot: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com" } }));

      const result = await temporaryOrderRepo.findTemporaryOrders({ search: "ana" });

      assert.equal(result.total, 1);
      assert.equal(result.data[0].contactSnapshot.firstName, "Ana");
    });

    it("sorts newest first and paginates", async () => {
      for (let i = 0; i < 3; i++) {
        await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder());
      }

      const result = await temporaryOrderRepo.findTemporaryOrders({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("findTemporaryOrdersPastRetention - the cleanup job's scan", () => {
    it("only returns orders whose tokenExpiration is before the given cutoff", async () => {
      const now = new Date();
      const wellExpired = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const stillWithinGrace = new Date(now.getTime() - 5 * 60 * 1000);
      const notExpiredYet = new Date(now.getTime() + 60 * 60 * 1000);

      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: wellExpired }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: stillWithinGrace }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: notExpiredYet }));

      const cutoff = new Date(now.getTime() - 60 * 60 * 1000); // 1h grace period
      const result = await temporaryOrderRepo.findTemporaryOrdersPastRetention(cutoff);

      assert.equal(result.length, 1, "only the order expired before the grace-adjusted cutoff should be past retention");
    });

    it("is unpaginated - returns everything past retention in one call", async () => {
      for (let i = 0; i < 5; i++) {
        await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ tokenExpiration: new Date(Date.now() - 60 * 60 * 1000) }));
      }
      const result = await temporaryOrderRepo.findTemporaryOrdersPastRetention(new Date());
      assert.equal(result.length, 5);
    });
  });

  describe("deleteTemporaryOrderById", () => {
    it("deletes the order", async () => {
      const created = await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder());
      await temporaryOrderRepo.deleteTemporaryOrderById(created._id);
      const found = await temporaryOrderRepo.findTemporaryOrderById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countTemporaryOrders", () => {
    it("counts matching a filter", async () => {
      const userId = new mongoose.Types.ObjectId();
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder({ user: userId }));
      await temporaryOrderRepo.createTemporaryOrder(validTemporaryOrder());

      const count = await temporaryOrderRepo.countTemporaryOrders({ user: userId });

      assert.equal(count, 1);
    });

    it("returns 0 when nothing matches", async () => {
      const count = await temporaryOrderRepo.countTemporaryOrders({ user: new mongoose.Types.ObjectId() });
      assert.equal(count, 0);
    });
  });
});