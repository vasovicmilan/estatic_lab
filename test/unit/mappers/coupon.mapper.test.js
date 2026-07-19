import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapCouponsForAdminList, mapCouponForAdminDetail, mapCouponForEdit, mapCouponForBookingPreview } from "../../../src/mappers/coupon.mapper.js";
import { buildCoupon, id } from "../../helpers/factories.js";

describe("coupon.mapper", () => {
  describe("discount value formatting", () => {
    it("shows a percentage discount with a % suffix", () => {
      const coupon = buildCoupon({ discountType: "percentage", discountValue: 15 });
      assert.equal(mapCouponForAdminDetail(coupon).osnovno.popust, "15%");
    });

    it("shows a fixed discount with an RSD suffix", () => {
      const coupon = buildCoupon({ discountType: "fixed", discountValue: 500 });
      assert.equal(mapCouponForAdminDetail(coupon).osnovno.popust, "500 RSD");
    });

    it("translates the discount type label too", () => {
      assert.equal(mapCouponForAdminDetail(buildCoupon({ discountType: "percentage" })).osnovno.tip, "Procenat");
      assert.equal(mapCouponForAdminDetail(buildCoupon({ discountType: "fixed" })).osnovno.tip, "Fiksni iznos");
    });
  });

  describe("usage limits", () => {
    it("shows 'Neograničeno' for a null/undefined maxUses", () => {
      assert.equal(mapCouponForAdminDetail(buildCoupon({ maxUses: null })).ogranicenja.maxUpotreba, "Neograničeno");
      assert.equal(mapCouponForAdminDetail(buildCoupon({ maxUses: undefined })).ogranicenja.maxUpotreba, "Neograničeno");
    });

    it("shows the actual number when a limit is set, including 0", () => {
      assert.equal(mapCouponForAdminDetail(buildCoupon({ maxUses: 100 })).ogranicenja.maxUpotreba, 100);
      assert.equal(mapCouponForAdminDetail(buildCoupon({ maxUses: 0 })).ogranicenja.maxUpotreba, 0);
    });

    it("defaults usedCount to 0 rather than showing null/undefined", () => {
      assert.equal(mapCouponForAdminDetail(buildCoupon({ usedCount: undefined })).ogranicenja.trenutnoIskorisceno, 0);
    });
  });

  describe("active status translation", () => {
    it("uses Aktivan/Neaktivan (different wording than the Da/Ne pattern used elsewhere)", () => {
      assert.equal(mapCouponForAdminDetail(buildCoupon({ isActive: true })).osnovno.aktivnost, "Aktivan");
      assert.equal(mapCouponForAdminDetail(buildCoupon({ isActive: false })).osnovno.aktivnost, "Neaktivan");
    });
  });

  describe("applicableServices - populated vs raw refs", () => {
    it("shows the service name when populated", () => {
      const service = { _id: id(), name: "Klasicna masaza" };
      const coupon = buildCoupon({ applicableServices: [service] });
      const mapped = mapCouponForAdminDetail(coupon);
      assert.equal(mapped.primenljivoNaUsluge[0].naziv, "Klasicna masaza");
    });

    it("falls back to just the id (no naziv key implied as undefined) when unpopulated", () => {
      const serviceId = id();
      const coupon = buildCoupon({ applicableServices: [serviceId] });
      const mapped = mapCouponForAdminDetail(coupon);
      assert.equal(mapped.primenljivoNaUsluge[0].id, serviceId.toString());
      assert.equal(mapped.primenljivoNaUsluge[0].naziv, undefined);
    });

    it("mapCouponForEdit flattens to plain id strings regardless of population state", () => {
      const populated = { _id: id(), name: "X" };
      const raw = id();
      const coupon = buildCoupon({ applicableServices: [populated, raw] });
      const mapped = mapCouponForEdit(coupon);
      assert.equal(mapped.applicableServices[0], populated._id.toString());
      assert.equal(mapped.applicableServices[1], raw.toString());
    });
  });

  describe("usage history", () => {
    it("resolves the user id whether populated or raw", () => {
      const userId = id();
      const coupon = buildCoupon({ usageHistory: [{ user: userId, appointment: null, discountAmount: 200, usedAt: new Date() }] });
      const mapped = mapCouponForAdminDetail(coupon);
      assert.equal(mapped.istorijaKoriscenja[0].korisnikId, userId.toString());
    });

    it("does NOT crash when appointment is null (the normal case for a package/order redemption) - a coupon is redeemed against exactly one of appointment/packagePurchase/order, never more than one", () => {
      const coupon = buildCoupon({
        usageHistory: [{ user: id(), appointment: null, packagePurchase: null, order: id(), discountAmount: 300, usedAt: new Date() }],
      });
      // should NOT throw
      const mapped = mapCouponForAdminDetail(coupon);
      assert.equal(mapped.istorijaKoriscenja[0].terminId, null);
      assert.equal(mapped.istorijaKoriscenja[0].paketId, null);
    });

    it("resolves whichever of appointment/packagePurchase/order was actually the redemption target", () => {
      const orderId = id();
      const coupon = buildCoupon({
        usageHistory: [{ user: id(), appointment: null, packagePurchase: null, order: orderId, discountAmount: 300, usedAt: new Date() }],
      });
      const mapped = mapCouponForAdminDetail(coupon);
      assert.equal(mapped.istorijaKoriscenja[0].porudzbinaId, orderId.toString());
    });
  });

  describe("mapCouponForBookingPreview - minimal, no usage history exposed", () => {
    it("only exposes code, discount, minimum value, and expiration", () => {
      const mapped = mapCouponForBookingPreview(buildCoupon({ code: "LETO10" }));
      assert.equal(mapped.kod, "LETO10");
      assert.ok(!("istorijaKoriscenja" in mapped));
      assert.ok(!("osnovno" in mapped));
    });
  });

  describe("mapCouponsForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapCouponsForAdminList([buildCoupon(), null]).length, 1);
    });
  });

  it("returns null for a null coupon across every mapper", () => {
    assert.equal(mapCouponForAdminDetail(null), null);
    assert.equal(mapCouponForEdit(null), null);
    assert.equal(mapCouponForBookingPreview(null), null);
  });
});