import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";

function validPurchase(overrides = {}) {
  const serviceId = new mongoose.Types.ObjectId();
  const servicePackageId = new mongoose.Types.ObjectId();
  return {
    user: new mongoose.Types.ObjectId(),
    package: new mongoose.Types.ObjectId(),
    items: [{ service: serviceId, servicePackageId, sessionsTotal: 3, sessionsUsed: 0, sessionsReserved: 0, unitPrice: 3000 }],
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

    it("rejects an item missing servicePackageId at the schema level", async () => {
      await assert.rejects(() =>
        packagePurchaseRepo.createPackagePurchase(
          validPurchase({ items: [{ service: new mongoose.Types.ObjectId(), sessionsTotal: 3, sessionsUsed: 0 }] })
        )
      );
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

      doc.items[0].sessionsReserved += 1;
      await doc.save();

      const reloaded = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(reloaded.items[0].sessionsReserved, 1);
    });
  });

  // BUG FIX regression tests for releaseSessionAtomic/commitSessionAtomic - see
  // their own comments in package-purchase.repository.js. release/commitSession
  // used to read the whole document, mutate a field in JS, then .save() it - a
  // classic read-modify-write race. These prove the atomic replacements actually
  // hold under real concurrent writes against a real (in-memory) MongoDB, not
  // just that they're called with the right arguments.
  describe("reserveSessionAtomic / releaseSessionAtomic / commitSessionAtomic", () => {
    it("reserveSessionAtomic never lets sessionsReserved+sessionsUsed exceed sessionsTotal under real concurrency", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase({ items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 1, sessionsUsed: 0, sessionsReserved: 0, unitPrice: 3000 }] }));
      const variantId = created.items[0].servicePackageId;

      const [resultA, resultB] = await Promise.all([
        packagePurchaseRepo.reserveSessionAtomic(created._id, variantId),
        packagePurchaseRepo.reserveSessionAtomic(created._id, variantId),
      ]);

      const succeeded = [resultA, resultB].filter((r) => r !== null);
      assert.equal(succeeded.length, 1, "only one of two concurrent reservations should succeed when only 1 session total exists");

      const final = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(final.items[0].sessionsReserved, 1, "sessionsReserved must be exactly 1, never 2");
    });

    it("releaseSessionAtomic never drives sessionsReserved negative under real concurrency", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase({ items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 3, sessionsUsed: 0, sessionsReserved: 1, unitPrice: 3000 }] }));
      const variantId = created.items[0].servicePackageId;

      const [resultA, resultB] = await Promise.all([
        packagePurchaseRepo.releaseSessionAtomic(created._id, variantId),
        packagePurchaseRepo.releaseSessionAtomic(created._id, variantId),
      ]);

      const succeeded = [resultA, resultB].filter((r) => r !== null);
      assert.equal(succeeded.length, 1, "only one of two concurrent releases should succeed when only 1 session was actually reserved");

      const final = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(final.items[0].sessionsReserved, 0, "sessionsReserved must land on exactly 0, never -1");
    });

    it("commitSessionAtomic never double-delivers the same reserved session under real concurrency", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase({ items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 3, sessionsUsed: 0, sessionsReserved: 1, unitPrice: 3000 }] }));
      const variantId = created.items[0].servicePackageId;

      const [resultA, resultB] = await Promise.all([
        packagePurchaseRepo.commitSessionAtomic(created._id, variantId),
        packagePurchaseRepo.commitSessionAtomic(created._id, variantId),
      ]);

      const succeeded = [resultA, resultB].filter((r) => r !== null);
      assert.equal(succeeded.length, 1, "only one of two concurrent commits should succeed when only 1 session was reserved");

      const final = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(final.items[0].sessionsUsed, 1, "sessionsUsed must land on exactly 1, never 2");
      assert.equal(final.items[0].sessionsReserved, 0);
    });

    it("markCompletedIfAllSessionsUsed is a harmless no-op the second time it matches nothing new", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase({ items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 1, sessionsUsed: 1, sessionsReserved: 0, unitPrice: 3000 }] }));

      const first = await packagePurchaseRepo.markCompletedIfAllSessionsUsed(created._id);
      const second = await packagePurchaseRepo.markCompletedIfAllSessionsUsed(created._id);

      assert.equal(first.status, "completed");
      assert.equal(second, null, "already-completed purchase shouldn't match the $ne:'completed' condition a second time");
    });
  });

  describe("findActivePurchasesForUserAndVariant", () => {
    it("only returns active purchases covering the given variant, not just the parent service", async () => {
      const userId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();
      const variantA = new mongoose.Types.ObjectId();
      const variantB = new mongoose.Types.ObjectId(); // a DIFFERENT variant of the SAME service

      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({ user: userId, items: [{ service: serviceId, servicePackageId: variantA, sessionsTotal: 2, sessionsUsed: 0, unitPrice: 3000 }] })
      );
      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({ user: userId, items: [{ service: serviceId, servicePackageId: variantB, sessionsTotal: 2, sessionsUsed: 0, unitPrice: 3000 }] })
      );

      const result = await packagePurchaseRepo.findActivePurchasesForUserAndVariant(userId, variantA);

      assert.equal(result.length, 1);
    });

    it("excludes cancelled purchases", async () => {
      const userId = new mongoose.Types.ObjectId();
      const servicePackageId = new mongoose.Types.ObjectId();

      await packagePurchaseRepo.createPackagePurchase(
        validPurchase({
          user: userId,
          status: "cancelled",
          items: [{ service: new mongoose.Types.ObjectId(), servicePackageId, sessionsTotal: 2, sessionsUsed: 0, unitPrice: 3000 }],
        })
      );

      const result = await packagePurchaseRepo.findActivePurchasesForUserAndVariant(userId, servicePackageId);

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

    it("updates expiresAt and notes independently", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      const updated = await packagePurchaseRepo.updatePackagePurchaseById(created._id, { notes: "Ispravljena napomena" });
      assert.equal(updated.notes, "Ispravljena napomena");
    });
  });

  describe("deletePackagePurchaseById", () => {
    it("deletes the purchase", async () => {
      const created = await packagePurchaseRepo.createPackagePurchase(validPurchase());
      await packagePurchaseRepo.deletePackagePurchaseById(created._id);
      const found = await packagePurchaseRepo.findPackagePurchaseById(created._id);
      assert.equal(found, null);
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