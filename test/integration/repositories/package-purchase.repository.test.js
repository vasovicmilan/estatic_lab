import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";

function validPurchase(overrides = {}) {
  const serviceId = new mongoose.Types.ObjectId();
  return {
    user: new mongoose.Types.ObjectId(),
    package: new mongoose.Types.ObjectId(),
    items: [{ service: serviceId, sessionsTotal: 3, sessionsUsed: 0 }],
    originalPrice: 9000,
    discountApplied: 0,
    pricePaid: 9000,
    purchasedBy: new mongoose.Types.ObjectId(),
    ...overrides,
  };
}

describe("package-purchase.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createPackagePurchase", () => {
    it("persists a purchase with default status 'active' and null expiresAt", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      assert.ok(created._id);
      assert.equal(created.status, "active");
      assert.equal(created.expiresAt, null);
    });
  });

  describe("findPackagePurchaseById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await packagePurchaseRepo.findPackagePurchaseById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("returns a plain lean object", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      const found = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(typeof found.save, "undefined", "lean() results shouldn't have Mongoose document methods");
    });
  });

  describe("findPackagePurchaseDocById", () => {
    it("returns a real Mongoose document whose nested items can be mutated and saved", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      const doc = await packagePurchaseRepo.findPackagePurchaseDocById(created._id);

      doc.items[0].sessionsUsed += 1;
      await doc.save();

      const reloaded = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(reloaded.items[0].sessionsUsed, 1);
    });
  });

  describe("findActivePurchasesForUserAndService", () => {
    it("only returns active purchases covering the given service", async () => {
      const userId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();
      const otherServiceId = new mongoose.Types.ObjectId();

      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({ user: userId, items: [{ service: serviceId, sessionsTotal: 2, sessionsUsed: 0 }] })
      );
      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({ user: userId, items: [{ service: otherServiceId, sessionsTotal: 2, sessionsUsed: 0 }] })
      );

      const result = await packagePurchaseRepo.findActivePurchasesForUserAndService(userId, serviceId);

      assert.equal(result.length, 1);
    });

    it("excludes cancelled purchases", async () => {
      const userId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();

      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({ user: userId, status: "cancelled", items: [{ service: serviceId, sessionsTotal: 2, sessionsUsed: 0 }] })
      );

      const result = await packagePurchaseRepo.findActivePurchasesForUserAndService(userId, serviceId);

      assert.equal(result.length, 0);
    });
  });

  describe("findPurchasesByUser", () => {
    it("returns only the given user's purchases, most recent first", async () => {
      const userId = new mongoose.Types.ObjectId();
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ user: userId, purchasedAt: new Date("2026-01-01") }));
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ user: userId, purchasedAt: new Date("2026-06-01") }));
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ user: new mongoose.Types.ObjectId() }));

      const result = await packagePurchaseRepo.findPurchasesByUser(userId);

      assert.equal(result.length, 2);
      assert.ok(new Date(result[0].purchasedAt) > new Date(result[1].purchasedAt));
    });
  });

  describe("updatePackagePurchaseById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      const updated = await packagePurchaseRepo.updatePackagePurchaseById(created._id, { status: "cancelled" });
      assert.equal(updated.status, "cancelled");
    });
  });

  describe("findPackagePurchases", () => {
    it("filters by userId and status, and paginates", async () => {
      const userId = new mongoose.Types.ObjectId();
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ user: userId, status: "active" }));
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ user: userId, status: "cancelled" }));
      await packagePurchaseRepo.createPackagePurchase(validPurchase({ status: "active" }));

      const result = await packagePurchaseRepo.findPackagePurchases({ filters: { userId, status: "active" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.total, 1);
    });
  });
});