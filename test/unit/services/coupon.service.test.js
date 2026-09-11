import { describe, it } from "node:test";
import assert from "node:assert/strict";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import productService from "../../../src/services/product.service.js";
import categoryService from "../../../src/services/category.service.js";
import * as couponService from "../../../src/services/coupon.service.js";
import { buildCoupon, buildProductDiscount, id } from "../../helpers/factories.js";

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
      t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ minValue: 5000 }));
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

    it("caps a percentage discount at maxDiscountAmount when set", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () =>
        buildCoupon({ discountType: "percentage", discountValue: 50, maxDiscountAmount: 300 })
      );
      // 50% of 1000 would be 500, but the cap limits it to 300
      const result = await couponService.validateCouponForBooking("KOD", { appointmentValue: 1000 });
      assert.equal(result.discountAmount, 300);
    });

    it("does not apply any cap when maxDiscountAmount is null", async (t) => {
      t.mock.method(couponRepo, "findCouponByCode", async () =>
        buildCoupon({ discountType: "percentage", discountValue: 50, maxDiscountAmount: null })
      );
      const result = await couponService.validateCouponForBooking("KOD", { appointmentValue: 1000 });
      assert.equal(result.discountAmount, 500);
    });
  });
});

describe("validateCouponForPackagePurchase", () => {
  it("rejects a nonexistent code", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () => null);
    await assert.rejects(
      () => couponService.validateCouponForPackagePurchase("NEPOSTOJI", { packageId: id(), purchaseValue: 8000 }),
      (err) => err.statusCode === 400
    );
  });

  it("rejects a package not on the coupon's applicablePackages allowlist", async (t) => {
    const allowedPackageId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ applicablePackages: [allowedPackageId] }));
    await assert.rejects(
      () => couponService.validateCouponForPackagePurchase("KOD", { packageId: id(), purchaseValue: 8000 }),
      (err) => err.statusCode === 400
    );
  });

  it("accepts a package that IS on the applicablePackages allowlist", async (t) => {
    const packageId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ applicablePackages: [packageId], discountType: "fixed", discountValue: 1000 })
    );
    const result = await couponService.validateCouponForPackagePurchase("KOD", { packageId, purchaseValue: 8000 });
    assert.equal(result.discountAmount, 1000);
  });

  it("ignores applicableServices entirely - that allowlist is for bookings, not package purchases", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ applicableServices: [id()], discountType: "fixed", discountValue: 500 }));
    const result = await couponService.validateCouponForPackagePurchase("KOD", { packageId: id(), purchaseValue: 8000 });
    assert.equal(result.discountAmount, 500);
  });

  it("computes a percentage discount against the purchase value", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ discountType: "percentage", discountValue: 10 }));
    const result = await couponService.validateCouponForPackagePurchase("KOD", { packageId: id(), purchaseValue: 8000 });
    assert.equal(result.discountAmount, 800);
  });

  it("respects the same maxUses cap as booking redemptions", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ maxUses: 1, usedCount: 1 }));
    await assert.rejects(
      () => couponService.validateCouponForPackagePurchase("KOD", { packageId: id(), purchaseValue: 8000 }),
      (err) => err.statusCode === 400
    );
  });
});

describe("validateCouponForOrder - separate rule set for products (artikli)", () => {
  it("rejects a coupon with no productDiscount configured at all - main discountType/Value never apply to orders", async (t) => {
    // main block says 50% off, but productDiscount was never set up for this
    // coupon - it must be unusable on a product order regardless
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ discountType: "percentage", discountValue: 50, productDiscount: null }));
    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 10000 }),
      (err) => err.statusCode === 400
    );
  });

  it("rejects an order value below productDiscount.minOrderValue", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ minOrderValue: 5000 }) })
    );
    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 3000 }),
      (err) => err.statusCode === 400
    );
  });

  it("rejects when none of the order's products are on productDiscount.applicableProducts", async (t) => {
    const allowedProductId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ applicableProducts: [allowedProductId] }) })
    );
    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [id(), id()], orderValue: 10000 }),
      (err) => err.statusCode === 400
    );
  });

  it("accepts when at least one product in the order matches applicableProducts", async (t) => {
    const allowedProductId = id();
    const otherProductId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({
        productDiscount: buildProductDiscount({ applicableProducts: [allowedProductId], discountType: "fixed", discountValue: 2000 }),
      })
    );
    const result = await couponService.validateCouponForOrder("KOD", { productIds: [otherProductId, allowedProductId], orderValue: 15000 });
    assert.equal(result.discountAmount, 2000);
  });

  it("computes a percentage discount against the productDiscount rate, independent of the main discountType/Value", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({
        discountType: "fixed",
        discountValue: 999, // main block value - must be ignored entirely for an order
        productDiscount: buildProductDiscount({ discountType: "percentage", discountValue: 5 }),
      })
    );
    // 5% of 20000 = 1000, not anywhere near the main block's fixed 999
    const result = await couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 20000 });
    assert.equal(result.discountAmount, 1000);
  });

  it("caps a percentage product discount at productDiscount.maxDiscountAmount - the exact scenario a device sale needs", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({
        productDiscount: buildProductDiscount({ discountType: "percentage", discountValue: 15, maxDiscountAmount: 5000 }),
      })
    );
    // 15% of a 200000 RSD device would be 30000, capped down to 5000
    const result = await couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 200000 });
    assert.equal(result.discountAmount, 5000);
  });

  it("never discounts more than the order's own value", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ discountType: "fixed", discountValue: 50000 }) })
    );
    const result = await couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 3000 });
    assert.equal(result.discountAmount, 3000);
  });

  it("respects the same maxUses cap as booking/package redemptions", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ maxUses: 1, usedCount: 1, productDiscount: buildProductDiscount() })
    );
    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 10000 }),
      (err) => err.statusCode === 400
    );
  });
});

describe("validateCouponForOrder - excludedCategories (devices/expensive items needing their own negotiation)", () => {
  it("rejects the whole order when a cart item is in an excluded category", async (t) => {
    const deviceCategoryId = id();
    const deviceProductId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ excludedCategories: [deviceCategoryId] }) })
    );
    t.mock.method(categoryService, "getCategoryAndDescendantIds", async (catId) => [catId.toString()]);
    t.mock.method(productService, "findProductsForCouponCheck", async () => [
      { id: deviceProductId.toString(), categoryIds: [deviceCategoryId.toString()] },
    ]);
    t.mock.method(categoryService, "getCategoriesByIds", async () => [{ id: deviceCategoryId.toString(), naziv: "Aparati i oprema" }]);

    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [deviceProductId], orderValue: 200000 }),
      (err) => err.statusCode === 400 && /Aparati i oprema/.test(err.message)
    );
  });

  it("names the specific excluded category in the error message, not a generic refusal", async (t) => {
    const categoryId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ excludedCategories: [categoryId] }) })
    );
    t.mock.method(categoryService, "getCategoryAndDescendantIds", async () => [categoryId.toString()]);
    t.mock.method(productService, "findProductsForCouponCheck", async () => [{ id: id().toString(), categoryIds: [categoryId.toString()] }]);
    t.mock.method(categoryService, "getCategoriesByIds", async () => [{ id: categoryId.toString(), naziv: "EMS uređaji" }]);

    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 50000 }),
      (err) => err.message.includes("EMS uređaji") && !err.message.includes("Kupon ne postoji")
    );
  });

  it("expands an excluded parent category to its descendants - a product in a child category is excluded too", async (t) => {
    const parentCategoryId = id();
    const childCategoryId = id();
    const productId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ excludedCategories: [parentCategoryId] }) })
    );
    // simulates category.service.js's own descendant expansion - the product is
    // only tagged with the CHILD category, never the parent directly
    t.mock.method(categoryService, "getCategoryAndDescendantIds", async () => [parentCategoryId.toString(), childCategoryId.toString()]);
    t.mock.method(productService, "findProductsForCouponCheck", async () => [{ id: productId.toString(), categoryIds: [childCategoryId.toString()] }]);
    t.mock.method(categoryService, "getCategoriesByIds", async () => [{ id: childCategoryId.toString(), naziv: "EMS uređaji" }]);

    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [productId], orderValue: 50000 }),
      (err) => err.statusCode === 400
    );
  });

  it("exclusion wins even when the excluded product is ALSO explicitly whitelisted on applicableProducts", async (t) => {
    const categoryId = id();
    const productId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({
        productDiscount: buildProductDiscount({ applicableProducts: [productId], excludedCategories: [categoryId] }),
      })
    );
    t.mock.method(categoryService, "getCategoryAndDescendantIds", async () => [categoryId.toString()]);
    t.mock.method(productService, "findProductsForCouponCheck", async () => [{ id: productId.toString(), categoryIds: [categoryId.toString()] }]);
    t.mock.method(categoryService, "getCategoriesByIds", async () => [{ id: categoryId.toString(), naziv: "Aparati" }]);

    await assert.rejects(
      () => couponService.validateCouponForOrder("KOD", { productIds: [productId], orderValue: 50000 }),
      (err) => err.statusCode === 400,
      "an explicit whitelist match must not override the category exclusion"
    );
  });

  it("never even looks up products when the coupon has no excludedCategories configured", async (t) => {
    t.mock.method(couponRepo, "findCouponByCode", async () => buildCoupon({ productDiscount: buildProductDiscount() }));
    const findMock = t.mock.method(productService, "findProductsForCouponCheck", async () => {
      throw new Error("should never be called - this coupon has no category exclusions at all");
    });

    const result = await couponService.validateCouponForOrder("KOD", { productIds: [id()], orderValue: 10000 });

    assert.equal(findMock.mock.calls.length, 0);
    assert.equal(result.discountAmount, 1000);
  });

  it("passes through cleanly when the cart has no items from any excluded category", async (t) => {
    const categoryId = id();
    const otherCategoryId = id();
    const productId = id();
    t.mock.method(couponRepo, "findCouponByCode", async () =>
      buildCoupon({ productDiscount: buildProductDiscount({ excludedCategories: [categoryId], discountType: "fixed", discountValue: 1500 }) })
    );
    t.mock.method(categoryService, "getCategoryAndDescendantIds", async () => [categoryId.toString()]);
    t.mock.method(productService, "findProductsForCouponCheck", async () => [{ id: productId.toString(), categoryIds: [otherCategoryId.toString()] }]);

    const result = await couponService.validateCouponForOrder("KOD", { productIds: [productId], orderValue: 20000 });

    assert.equal(result.discountAmount, 1500);
  });
});

describe("resolveProductCouponEligibility / isProductCouponEligible", () => {
  it("returns a null applicableProductIds (no restriction) and an empty excluded set for a plain productDiscount", async () => {
    const eligibility = await couponService.resolveProductCouponEligibility(buildProductDiscount());
    assert.equal(eligibility.applicableProductIds, null);
    assert.equal(eligibility.excludedCategoryIds.size, 0);
  });

  it("returns an empty-but-defined result for a null productDiscount (coupon doesn't cover artikli at all)", async () => {
    const eligibility = await couponService.resolveProductCouponEligibility(null);
    assert.equal(eligibility.applicableProductIds.size, 0);
    assert.equal(eligibility.excludedCategoryIds.size, 0);
  });

  it("isProductCouponEligible: false when the product's own category is in the excluded set, even with no whitelist restriction", () => {
    const eligibility = { applicableProductIds: null, excludedCategoryIds: new Set(["cat1"]) };
    assert.equal(couponService.isProductCouponEligible({ id: "p1", categoryIds: ["cat1"] }, eligibility), false);
  });

  it("isProductCouponEligible: false when a whitelist exists and the product isn't on it", () => {
    const eligibility = { applicableProductIds: new Set(["p1"]), excludedCategoryIds: new Set() };
    assert.equal(couponService.isProductCouponEligible({ id: "p2", categoryIds: [] }, eligibility), false);
  });

  it("isProductCouponEligible: true when there's no restriction at all and no category exclusion match", () => {
    const eligibility = { applicableProductIds: null, excludedCategoryIds: new Set(["cat-other"]) };
    assert.equal(couponService.isProductCouponEligible({ id: "p1", categoryIds: ["cat1"] }, eligibility), true);
  });
});

describe("redeemCoupon - packagePurchaseId pass-through", () => {
  it("forwards packagePurchaseId to the repository alongside a null appointmentId", async (t) => {
    const purchaseId = id();
    let forwarded;
    t.mock.method(couponRepo, "redeemCoupon", async (couponId, payload) => {
      forwarded = payload;
      return {};
    });

    await couponService.redeemCoupon(id(), { userId: id(), packagePurchaseId: purchaseId, discountAmount: 500 });

    assert.equal(forwarded.packagePurchaseId, purchaseId);
    assert.equal(forwarded.appointmentId, null);
  });

  // The repository's redeemCoupon now conditions its update on usedCount < maxUses
  // (atomic, in the same query as the $inc - see coupon.repository.js's own comment
  // for the race this closes) and returns null when that condition doesn't match,
  // rather than throwing itself - it's this service layer's job to turn "the atomic
  // update matched nothing" into a real error the caller's transaction can abort on.
  it("throws a 409 conflict if the atomic update matched nothing - someone else's concurrent redemption won the race", async (t) => {
    t.mock.method(couponRepo, "redeemCoupon", async () => null);

    await assert.rejects(
      () => couponService.redeemCoupon(id(), { userId: id(), discountAmount: 500 }),
      (err) => err.statusCode === 409
    );
  });
});

describe("listCouponsForPartner", () => {
  it("returns productDiscount as null when the coupon doesn't have one, instead of an empty object", async (t) => {
    const coupon = buildCoupon({ partner: id(), productDiscount: null });
    t.mock.method(couponRepo, "findCoupons", async () => ({ data: [coupon], total: 1 }));

    const [result] = await couponService.listCouponsForPartner(coupon.partner.toString());

    assert.equal(result.productDiscount, null);
  });

  it("surfaces productDiscount's own discountType/discountValue when the coupon has one", async (t) => {
    const coupon = buildCoupon({ partner: id(), productDiscount: buildProductDiscount({ discountType: "fixed", discountValue: 300 }) });
    t.mock.method(couponRepo, "findCoupons", async () => ({ data: [coupon], total: 1 }));

    const [result] = await couponService.listCouponsForPartner(coupon.partner.toString());

    assert.deepEqual(result.productDiscount, { discountType: "fixed", discountValue: 300, applicableProducts: [], excludedCategories: [] });
  });

  it("surfaces productDiscount's applicableProducts/excludedCategories as raw id strings, for the partner catalog to filter with", async (t) => {
    const productId = id();
    const categoryId = id();
    const coupon = buildCoupon({
      partner: id(),
      productDiscount: buildProductDiscount({ applicableProducts: [productId], excludedCategories: [categoryId] }),
    });
    t.mock.method(couponRepo, "findCoupons", async () => ({ data: [coupon], total: 1 }));

    const [result] = await couponService.listCouponsForPartner(coupon.partner.toString());

    assert.deepEqual(result.productDiscount.applicableProducts, [productId.toString()]);
    assert.deepEqual(result.productDiscount.excludedCategories, [categoryId.toString()]);
  });

  it("surfaces validUntil/maxUses/usedCount for a more precise dashboard display", async (t) => {
    const coupon = buildCoupon({ partner: id(), validUntil: new Date("2026-12-31"), maxUses: 50, usedCount: 12 });
    t.mock.method(couponRepo, "findCoupons", async () => ({ data: [coupon], total: 1 }));

    const [result] = await couponService.listCouponsForPartner(coupon.partner.toString());

    assert.deepEqual(result.validUntil, coupon.validUntil);
    assert.equal(result.maxUses, 50);
    assert.equal(result.usedCount, 12);
  });
});