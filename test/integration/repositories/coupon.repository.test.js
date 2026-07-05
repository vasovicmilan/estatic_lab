import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";

function validCoupon(overrides = {}) {
  return {
    code: "dobrodosli10",
    discountType: "percentage",
    discountValue: 10,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("coupon.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createCoupon", () => {
    it("persists a coupon and uppercases the code at the schema level", async () => {
      const coupon = await couponRepo.createCoupon(validCoupon());
      assert.ok(coupon._id);
      assert.equal(coupon.code, "DOBRODOSLI10", "the schema's uppercase:true should normalize the code");
    });

    it("rejects a duplicate code (unique index), case-insensitively since it's normalized to uppercase", async () => {
      await couponRepo.createCoupon(validCoupon({ code: "KOD10" }));
      await assert.rejects(() => couponRepo.createCoupon(validCoupon({ code: "kod10" })));
    });
  });

  describe("findCouponByCode", () => {
    it("finds a coupon regardless of the case it's queried with", async () => {
      await couponRepo.createCoupon(validCoupon({ code: "LETO2026" }));
      const found = await couponRepo.findCouponByCode("leto2026");
      assert.ok(found);
      assert.equal(found.code, "LETO2026");
    });

    it("returns null for a nonexistent code", async () => {
      const found = await couponRepo.findCouponByCode("NEPOSTOJI");
      assert.equal(found, null);
    });
  });

  describe("countCouponUsagesByUser", () => {
    it("counts only the usage entries belonging to the given user", async () => {
      const userA = new mongoose.Types.ObjectId();
      const userB = new mongoose.Types.ObjectId();
      const coupon = await couponRepo.createCoupon(validCoupon());

      await couponRepo.redeemCoupon(coupon._id, { userId: userA, appointmentId: new mongoose.Types.ObjectId(), discountAmount: 100 });
      await couponRepo.redeemCoupon(coupon._id, { userId: userA, appointmentId: new mongoose.Types.ObjectId(), discountAmount: 100 });
      await couponRepo.redeemCoupon(coupon._id, { userId: userB, appointmentId: new mongoose.Types.ObjectId(), discountAmount: 100 });

      const countA = await couponRepo.countCouponUsagesByUser(coupon._id, userA);
      const countB = await couponRepo.countCouponUsagesByUser(coupon._id, userB);

      assert.equal(countA, 2);
      assert.equal(countB, 1);
    });

    it("returns 0 for a user who has never redeemed the coupon", async () => {
      const coupon = await couponRepo.createCoupon(validCoupon());
      const count = await couponRepo.countCouponUsagesByUser(coupon._id, new mongoose.Types.ObjectId());
      assert.equal(count, 0);
    });
  });

  describe("redeemCoupon", () => {
    it("atomically increments usedCount and appends to usageHistory in one update", async () => {
      const coupon = await couponRepo.createCoupon(validCoupon());
      const userId = new mongoose.Types.ObjectId();
      const appointmentId = new mongoose.Types.ObjectId();

      const updated = await couponRepo.redeemCoupon(coupon._id, { userId, appointmentId, discountAmount: 250 });

      assert.equal(updated.usedCount, 1);
      assert.equal(updated.usageHistory.length, 1);
      assert.equal(updated.usageHistory[0].discountAmount, 250);
      assert.equal(String(updated.usageHistory[0].user), String(userId));
    });

    it("accumulates usedCount correctly across multiple redemptions", async () => {
      const coupon = await couponRepo.createCoupon(validCoupon());

      await couponRepo.redeemCoupon(coupon._id, {
        userId: new mongoose.Types.ObjectId(),
        appointmentId: new mongoose.Types.ObjectId(),
        discountAmount: 100,
      });
      const updated = await couponRepo.redeemCoupon(coupon._id, {
        userId: new mongoose.Types.ObjectId(),
        appointmentId: new mongoose.Types.ObjectId(),
        discountAmount: 100,
      });

      assert.equal(updated.usedCount, 2);
      assert.equal(updated.usageHistory.length, 2);
    });
  });

  describe("findCoupons", () => {
    it("filters by isActive", async () => {
      await couponRepo.createCoupon(validCoupon({ code: "AKTIVAN", isActive: true }));
      await couponRepo.createCoupon(validCoupon({ code: "NEAKTIVAN", isActive: false }));

      const result = await couponRepo.findCoupons({ filters: { isActive: true } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].code, "AKTIVAN");
    });

    it("searches by code", async () => {
      await couponRepo.createCoupon(validCoupon({ code: "LETO2026" }));
      await couponRepo.createCoupon(validCoupon({ code: "ZIMA2026" }));

      const result = await couponRepo.findCoupons({ search: "leto" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].code, "LETO2026");
    });
  });

  describe("updateCouponById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await couponRepo.createCoupon(validCoupon());
      const updated = await couponRepo.updateCouponById(created._id, { isActive: false });
      assert.equal(updated.isActive, false);
    });
  });

  describe("deleteCouponById", () => {
    it("deletes the coupon", async () => {
      const created = await couponRepo.createCoupon(validCoupon());
      await couponRepo.deleteCouponById(created._id);
      const found = await couponRepo.findCouponById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countCoupons", () => {
    it("counts coupons matching a filter", async () => {
      await couponRepo.createCoupon(validCoupon({ code: "A", isActive: true }));
      await couponRepo.createCoupon(validCoupon({ code: "B", isActive: false }));

      const count = await couponRepo.countCoupons({ isActive: true });

      assert.equal(count, 1);
    });
  });
});