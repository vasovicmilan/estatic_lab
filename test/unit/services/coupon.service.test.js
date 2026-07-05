import { describe, it } from "node:test";
import assert from "node:assert/strict";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import * as couponService from "../../../src/services/coupon.service.js";
import { buildCoupon, id } from "../../helpers/factories.js";

describe("coupon.service", () => {
  describe("createCoupon", () => {
    it("uppercases the code before storing", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => null);
      let created;
      t.mock.method(couponRepo, "createCoupon", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(couponRepo, "findCouponById", async () => created);

      await couponService.createCoupon({ code: "dobrodosli10", discountType: "percentage", discountValue: 10, validUntil: new Date() });

      assert.equal(created.code, "DOBRODOSLI10");
    });

    it("rejects a duplicate code (case-insensitively, since codes are stored uppercase)", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ code: "DOBRODOSLI10" }));
      await assert.rejects(
        () => couponService.createCoupon({ code: "dobrodosli10", discountType: "percentage", discountValue: 10, validUntil: new Date() }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("validateCouponForBooking", () => {
    it("rejects a nonexistent code", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => null);
      await assert.rejects(
        () => couponService.validateCouponForBooking("NEPOSTOJI", { serviceId: id(), appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a deactivated coupon", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ isActive: false }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a coupon that isn't valid yet", async (t) => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ validFrom: future }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an expired coupon", async (t) => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ validUntil: past }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a booking value below the coupon's minimum", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ minAppointmentValue: 5000 }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a service not on the coupon's applicable-services allowlist", async (t) => {
      const allowedServiceId = id();
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ applicableServices: [allowedServiceId] }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { serviceId: id(), appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("accepts a service that IS on the applicable-services allowlist", async (t) => {
      const serviceId = id();
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ applicableServices: [serviceId], discountType: "fixed", discountValue: 500 }));
      const result = await couponService.validateCouponForBooking("KOD", { serviceId, appointmentValue: 3000 });
      assert.equal(result.discountAmount, 500);
    });

    it("rejects once the global maxUses cap is reached", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ maxUses: 5, usedCount: 5 }));
      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects once a specific user has hit their personal maxUsesPerUser cap", async (t) => {
      const coupon = buildCoupon({ maxUsesPerUser: 1 });
      t.mock.method(couponRepo, "findCouponByCode", async () => coupon);
      t.mock.method(couponRepo, "countCouponUsagesByUser", async () => 1);

      await assert.rejects(
        () => couponService.validateCouponForBooking("KOD", { userId: id(), appointmentValue: 3000 }),
        (err) => err.statusCode === 400
      );
    });

    it("skips the per-user check entirely when userId is null (brand-new guest)", async (t) => {
      const coupon = buildCoupon({ maxUsesPerUser: 1, discountType: "fixed", discountValue: 300 });
      t.mock.method(couponRepo, "findCouponByCode", async () => coupon);
      const usageCheckMock = t.mock.method(couponRepo, "countCouponUsagesByUser", async () => 99);

      const result = await couponService.validateCouponForBooking("KOD", { userId: null, appointmentValue: 3000 });

      assert.equal(usageCheckMock.mock.calls.length, 0, "per-user usage should never be queried without a userId");
      assert.equal(result.discountAmount, 300);
    });

    it("computes a percentage discount correctly", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ discountType: "percentage", discountValue: 20 }));
      const result = await couponService.validateCouponForBooking("KOD", { appointmentValue: 1000 });
      assert.equal(result.discountAmount, 200);
    });

    it("never discounts more than the appointment's own value", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ discountType: "fixed", discountValue: 5000 }));
      const result = await couponService.validateCouponForBooking("KOD", { appointmentValue: 2000 });
      assert.equal(result.discountAmount, 2000);
    });
  });
});