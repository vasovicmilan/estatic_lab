import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import couponService from "../../../src/services/coupon.service.js";
import * as packagePurchaseService from "../../../src/services/package-purchase.service.js";
import { buildPackagePurchase, buildPackage, buildCoupon, id } from "../../helpers/factories.js";

describe("package-purchase.service", () => {
  describe("createPurchaseForUser", () => {
    it("snapshots the package's items into sessionsTotal/sessionsUsed:0", async (t) => {
      const serviceIdA = id();
      const serviceIdB = id();
      const pkg = buildPackage({
        items: [
          { service: serviceIdA, sessions: 3 },
          { service: serviceIdB, sessions: 2 },
        ],
        totalPrice: 10000,
      });
      t.mock.method(packageRepo, "findPackageById", async () => pkg);

      let created;
      t.mock.method(packagePurchaseRepo, "createPackagePurchase", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => created);

      await packagePurchaseService.createPurchaseForUser(id().toString(), pkg._id.toString(), id().toString());

      assert.equal(created.items.length, 2);
      assert.equal(created.items[0].sessionsTotal, 3);
      assert.equal(created.items[0].sessionsUsed, 0);
      assert.equal(created.originalPrice, 10000);
      assert.equal(created.pricePaid, 10000);
    });

    it("throws 404 for a nonexistent package", async (t) => {
      t.mock.method(packageRepo, "findPackageById", async () => null);
      await assert.rejects(
        () => packagePurchaseService.createPurchaseForUser(id().toString(), id().toString(), id().toString()),
        (err) => err.statusCode === 404
      );
    });

    it("lets the admin override the price paid instead of using the package's own price", async (t) => {
      const pkg = buildPackage({ totalPrice: 10000 });
      t.mock.method(packageRepo, "findPackageById", async () => pkg);
      let created;
      t.mock.method(packagePurchaseRepo, "createPackagePurchase", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => created);

      await packagePurchaseService.createPurchaseForUser(id().toString(), pkg._id.toString(), id().toString(), { pricePaid: 7500 });

      assert.equal(created.originalPrice, 7500);
      assert.equal(created.pricePaid, 7500);
    });

    it("applies a coupon and redeems it, discounting pricePaid", async (t) => {
      const pkg = buildPackage({ totalPrice: 10000 });
      t.mock.method(packageRepo, "findPackageById", async () => pkg);
      const coupon = buildCoupon({ discountType: "fixed", discountValue: 2000 });
      t.mock.method(couponService, "validateCouponForPackagePurchase", async () => ({ coupon, discountAmount: 2000 }));
      const redeemMock = t.mock.method(couponService, "redeemCoupon", async () => { });

      let created;
      t.mock.method(packagePurchaseRepo, "createPackagePurchase", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => created);

      await packagePurchaseService.createPurchaseForUser(id().toString(), pkg._id.toString(), id().toString(), { couponCode: "LETO" });

      assert.equal(created.discountApplied, 2000);
      assert.equal(created.pricePaid, 8000);
      assert.equal(created.coupon, coupon._id);
      assert.equal(redeemMock.mock.calls.length, 1);
      assert.equal(redeemMock.mock.calls[0].arguments[1].packagePurchaseId, created._id);
    });
  });

  describe("findUsablePurchaseForService — auto-pick ordering", () => {
    it("prefers a purchase that expires sooner over one that expires later", async (t) => {
      const serviceId = id();
      const expiresLater = buildPackagePurchase({ serviceId, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) });
      const expiresSooner = buildPackagePurchase({ serviceId, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => [expiresLater, expiresSooner]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), serviceId.toString());

      assert.equal(String(result._id), String(expiresSooner._id));
    });

    it("prefers an expiring purchase over one that never expires", async (t) => {
      const serviceId = id();
      const neverExpires = buildPackagePurchase({ serviceId, expiresAt: null });
      const expires = buildPackagePurchase({ serviceId, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => [neverExpires, expires]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), serviceId.toString());

      assert.equal(String(result._id), String(expires._id));
    });

    it("falls back to oldest-purchased-first when neither expires", async (t) => {
      const serviceId = id();
      const older = buildPackagePurchase({ serviceId, expiresAt: null, purchasedAt: new Date("2026-01-01") });
      const newer = buildPackagePurchase({ serviceId, expiresAt: null, purchasedAt: new Date("2026-06-01") });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => [newer, older]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), serviceId.toString());

      assert.equal(String(result._id), String(older._id));
    });

    it("excludes a purchase with zero remaining sessions for that service", async (t) => {
      const serviceId = id();
      const exhausted = buildPackagePurchase({ serviceId });
      exhausted.items[0].sessionsUsed = exhausted.items[0].sessionsTotal;
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => [exhausted]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), serviceId.toString());

      assert.equal(result, null);
    });

    it("excludes an expired purchase", async (t) => {
      const serviceId = id();
      const expired = buildPackagePurchase({ serviceId, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => [expired]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), serviceId.toString());

      assert.equal(result, null);
    });

    it("returns null when the user has nothing usable for this service", async (t) => {
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndService", async () => []);
      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), id().toString());
      assert.equal(result, null);
    });
  });

  describe("assertUsablePurchase — the server-side check that a client selection alone can never bypass", () => {
    it("rejects a purchase belonging to a different user", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), id().toString(), purchase.items[0].service.toString()),
        (err) => err.statusCode === 403
      );
    });

    it("rejects a cancelled purchase", async (t) => {
      const purchase = buildPackagePurchase({ status: "cancelled" });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), purchase.user.toString(), purchase.items[0].service.toString()),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an expired purchase", async (t) => {
      const purchase = buildPackagePurchase({ expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), purchase.user.toString(), purchase.items[0].service.toString()),
        (err) => err.statusCode === 400
      );
    });

    // the exact rule from this session: a package covering massages can't pay for
    // electro-therapy — this is the check that enforces it
    it("rejects a service the package doesn't cover at all", async (t) => {
      const purchase = buildPackagePurchase(); // covers only its own single service
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), purchase.user.toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a covered service with zero sessions remaining", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsUsed = purchase.items[0].sessionsTotal;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), purchase.user.toString(), purchase.items[0].service.toString()),
        (err) => err.statusCode === 400
      );
    });

    it("accepts a covered service with sessions remaining, owned by the right user, still active", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      const result = await packagePurchaseService.assertUsablePurchase(
        purchase._id.toString(),
        purchase.user.toString(),
        purchase.items[0].service.toString()
      );
      assert.equal(String(result._id), String(purchase._id));
    });

    it("throws 404 for a nonexistent purchase id", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => null);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(id().toString(), id().toString(), id().toString()),
        (err) => err.statusCode === 404
      );
    });
  });

  describe("consumeSession", () => {
    it("increments sessionsUsed for the matching service item", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.consumeSession(purchase._id.toString(), purchase.items[0].service.toString());

      assert.equal(purchase.items[0].sessionsUsed, 1);
    });

    it("marks the purchase 'completed' once every item's sessions are fully used", async (t) => {
      const serviceId = id();
      const purchase = buildPackagePurchase({ serviceId });
      purchase.items[0].sessionsTotal = 1;
      purchase.items[0].sessionsUsed = 0;
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.consumeSession(purchase._id.toString(), serviceId.toString());

      assert.equal(purchase.status, "completed");
    });

    it("leaves status 'active' when other items still have sessions left", async (t) => {
      const serviceA = id();
      const serviceB = id();
      const purchase = buildPackagePurchase();
      purchase.items = [
        { service: serviceA, sessionsTotal: 1, sessionsUsed: 0 },
        { service: serviceB, sessionsTotal: 3, sessionsUsed: 0 },
      ];
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.consumeSession(purchase._id.toString(), serviceA.toString());

      assert.equal(purchase.status, "active");
    });

    it("rejects consuming a session for a service the purchase doesn't cover", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.consumeSession(purchase._id.toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("rejects consuming past the total (defense in depth)", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsUsed = purchase.items[0].sessionsTotal;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.consumeSession(purchase._id.toString(), purchase.items[0].service.toString()),
        (err) => err.statusCode === 400
      );
    });

    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => null);
      await assert.rejects(() => packagePurchaseService.consumeSession(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("cancelPurchase", () => {
    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "updatePackagePurchaseById", async () => null);
      await assert.rejects(() => packagePurchaseService.cancelPurchase(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("createPackage — variant scoping", () => {
    it("rejects an item with no servicePackageId", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [{ service: id(), sessions: 1 }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a servicePackageId that doesn't belong to the referenced service's own variants", async (t) => {
      const service = buildService({ packages: [buildServicePackageVariant({ _id: id() })] });
      t.mock.method(serviceRepo, "findServiceById", async () => service);
      await assert.rejects(
        () =>
          packageService.createPackage({
            name: "X",
            totalPrice: 1000,
            items: [{ service: service._id.toString(), servicePackageId: id().toString(), sessions: 1 }],
          }),
        (err) => err.statusCode === 400
      );
    });

    it("accepts an item whose servicePackageId is a real variant of the referenced service", async (t) => {
      const variant = buildServicePackageVariant();
      const service = buildService({ packages: [variant] });
      t.mock.method(serviceRepo, "findServiceById", async () => service);
      t.mock.method(packageRepo, "findPackageBySlug", async () => null);
      let created;
      t.mock.method(packageRepo, "createPackage", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(packageRepo, "findPackageById", async () => created);

      await packageService.createPackage({
        name: "Dan Za Sebe",
        totalPrice: 8000,
        items: [{ service: service._id.toString(), servicePackageId: variant._id.toString(), sessions: 1 }],
      });

      assert.equal(String(created.items[0].servicePackageId), variant._id.toString());
    });
  });
});