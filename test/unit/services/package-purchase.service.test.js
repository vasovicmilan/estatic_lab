import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import couponService from "../../../src/services/coupon.service.js";
import * as packagePurchaseService from "../../../src/services/package-purchase.service.js";
import { buildPackagePurchase, buildPackage, buildCoupon, id } from "../../helpers/factories.js";

describe("package-purchase.service", () => {
  describe("createPurchaseForUser", () => {
    it("snapshots the package's items into sessionsTotal/sessionsUsed:0/sessionsReserved:0, carrying servicePackageId through", async (t) => {
      const serviceIdA = id();
      const servicePackageIdA = id();
      const serviceIdB = id();
      const servicePackageIdB = id();
      const pkg = buildPackage({
        items: [
          { service: serviceIdA, servicePackageId: servicePackageIdA, sessions: 3 },
          { service: serviceIdB, servicePackageId: servicePackageIdB, sessions: 2 },
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
      assert.equal(created.items[0].sessionsReserved, 0);
      assert.equal(String(created.items[0].servicePackageId), String(servicePackageIdA));
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
      const redeemMock = t.mock.method(couponService, "redeemCoupon", async () => {});

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

  describe("findUsablePurchaseForService — auto-pick ordering, scoped to the exact variant", () => {
    it("prefers a purchase that expires sooner over one that expires later", async (t) => {
      const servicePackageId = id();
      const expiresLater = buildPackagePurchase({ servicePackageId, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) });
      const expiresSooner = buildPackagePurchase({ servicePackageId, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => [expiresLater, expiresSooner]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), servicePackageId.toString());

      assert.equal(String(result._id), String(expiresSooner._id));
    });

    it("prefers an expiring purchase over one that never expires", async (t) => {
      const servicePackageId = id();
      const neverExpires = buildPackagePurchase({ servicePackageId, expiresAt: null });
      const expires = buildPackagePurchase({ servicePackageId, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => [neverExpires, expires]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), servicePackageId.toString());

      assert.equal(String(result._id), String(expires._id));
    });

    it("falls back to oldest-purchased-first when neither expires", async (t) => {
      const servicePackageId = id();
      const older = buildPackagePurchase({ servicePackageId, expiresAt: null, purchasedAt: new Date("2026-01-01") });
      const newer = buildPackagePurchase({ servicePackageId, expiresAt: null, purchasedAt: new Date("2026-06-01") });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => [newer, older]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), servicePackageId.toString());

      assert.equal(String(result._id), String(older._id));
    });

    it("excludes a purchase with zero remaining sessions, accounting for reservations", async (t) => {
      const servicePackageId = id();
      const exhausted = buildPackagePurchase({ servicePackageId });
      exhausted.items[0].sessionsTotal = 2;
      exhausted.items[0].sessionsUsed = 1;
      exhausted.items[0].sessionsReserved = 1; // fully claimed even though not all "used" yet
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => [exhausted]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), servicePackageId.toString());

      assert.equal(result, null);
    });

    it("excludes an expired purchase", async (t) => {
      const servicePackageId = id();
      const expired = buildPackagePurchase({ servicePackageId, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => [expired]);

      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), servicePackageId.toString());

      assert.equal(result, null);
    });

    it("returns null when the user has nothing usable for this variant", async (t) => {
      t.mock.method(packagePurchaseRepo, "findActivePurchasesForUserAndVariant", async () => []);
      const result = await packagePurchaseService.findUsablePurchaseForService(id().toString(), id().toString());
      assert.equal(result, null);
    });
  });

  describe("assertUsablePurchase — the server-side check a client selection alone can never bypass", () => {
    it("rejects a purchase belonging to a different user", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), id().toString(), purchase.items[0].servicePackageId.toString()),
        (err) => err.statusCode === 403
      );
    });

    it("rejects a cancelled purchase", async (t) => {
      const purchase = buildPackagePurchase({ status: "cancelled" });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () =>
          packagePurchaseService.assertUsablePurchase(
            purchase._id.toString(),
            purchase.user.toString(),
            purchase.items[0].servicePackageId.toString()
          ),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an expired purchase", async (t) => {
      const purchase = buildPackagePurchase({ expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () =>
          packagePurchaseService.assertUsablePurchase(
            purchase._id.toString(),
            purchase.user.toString(),
            purchase.items[0].servicePackageId.toString()
          ),
        (err) => err.statusCode === 400
      );
    });

    // the exact rule from this feature: a package covering ONE specific variant
    // can't be used to pay for a different variant of the same service, let alone
    // an unrelated service
    it("rejects a variant the package doesn't cover at all", async (t) => {
      const purchase = buildPackagePurchase(); // covers only its own single servicePackageId
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.assertUsablePurchase(purchase._id.toString(), purchase.user.toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a covered variant with zero sessions remaining", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsUsed = purchase.items[0].sessionsTotal;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () =>
          packagePurchaseService.assertUsablePurchase(
            purchase._id.toString(),
            purchase.user.toString(),
            purchase.items[0].servicePackageId.toString()
          ),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a covered variant that's fully reserved, even though sessionsUsed is 0", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsTotal = 1;
      purchase.items[0].sessionsReserved = 1;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      await assert.rejects(
        () =>
          packagePurchaseService.assertUsablePurchase(
            purchase._id.toString(),
            purchase.user.toString(),
            purchase.items[0].servicePackageId.toString()
          ),
        (err) => err.statusCode === 400
      );
    });

    it("accepts a covered variant with sessions remaining, owned by the right user, still active", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => purchase);
      const result = await packagePurchaseService.assertUsablePurchase(
        purchase._id.toString(),
        purchase.user.toString(),
        purchase.items[0].servicePackageId.toString()
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

  describe("reserveSession", () => {
    it("increments sessionsReserved without touching sessionsUsed", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.reserveSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString());

      assert.equal(purchase.items[0].sessionsReserved, 1);
      assert.equal(purchase.items[0].sessionsUsed, 0);
    });

    it("rejects reserving when nothing is available, accounting for existing reservations", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsTotal = 1;
      purchase.items[0].sessionsReserved = 1;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.reserveSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString()),
        (err) => err.statusCode === 400
      );
    });

    it("rejects reserving for a variant the purchase doesn't cover", async (t) => {
      const purchase = buildPackagePurchase();
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);
      await assert.rejects(
        () => packagePurchaseService.reserveSession(purchase._id.toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => null);
      await assert.rejects(() => packagePurchaseService.reserveSession(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("releaseSession", () => {
    it("decrements sessionsReserved, giving the slot back", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsReserved = 1;
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.releaseSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString());

      assert.equal(purchase.items[0].sessionsReserved, 0);
    });

    it("never goes negative even if called when nothing was reserved", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsReserved = 0;
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.releaseSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString());

      assert.equal(purchase.items[0].sessionsReserved, 0);
    });

    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => null);
      await assert.rejects(() => packagePurchaseService.releaseSession(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("commitSession", () => {
    it("moves one unit from reserved to used", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsReserved = 1;
      purchase.items[0].sessionsUsed = 0;
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.commitSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString());

      assert.equal(purchase.items[0].sessionsReserved, 0);
      assert.equal(purchase.items[0].sessionsUsed, 1);
    });

    it("marks the purchase 'completed' once every item's sessions are fully used", async (t) => {
      const purchase = buildPackagePurchase();
      purchase.items[0].sessionsTotal = 1;
      purchase.items[0].sessionsReserved = 1;
      purchase.items[0].sessionsUsed = 0;
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.commitSession(purchase._id.toString(), purchase.items[0].servicePackageId.toString());

      assert.equal(purchase.status, "completed");
    });

    it("leaves status 'active' when other items still have sessions left", async (t) => {
      const servicePackageA = id();
      const servicePackageB = id();
      const purchase = buildPackagePurchase();
      purchase.items = [
        { service: id(), servicePackageId: servicePackageA, sessionsTotal: 1, sessionsUsed: 0, sessionsReserved: 1 },
        { service: id(), servicePackageId: servicePackageB, sessionsTotal: 3, sessionsUsed: 0, sessionsReserved: 0 },
      ];
      purchase.save = async () => purchase;
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => purchase);

      await packagePurchaseService.commitSession(purchase._id.toString(), servicePackageA.toString());

      assert.equal(purchase.status, "active");
    });

    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseDocById", async () => null);
      await assert.rejects(() => packagePurchaseService.commitSession(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("updatePurchase", () => {
    it("only ever touches expiresAt/notes, never items or pricing", async (t) => {
      let forwarded;
      t.mock.method(packagePurchaseRepo, "updatePackagePurchaseById", async (purchaseId, data) => {
        forwarded = data;
        return buildPackagePurchase();
      });
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => buildPackagePurchase());

      await packagePurchaseService.updatePurchase(id().toString(), { notes: "Ispravljena napomena" });

      assert.deepEqual(Object.keys(forwarded), ["notes"]);
    });

    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "updatePackagePurchaseById", async () => null);
      await assert.rejects(() => packagePurchaseService.updatePurchase(id().toString(), { notes: "x" }), (err) => err.statusCode === 404);
    });
  });

  describe("cancelPurchase", () => {
    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "updatePackagePurchaseById", async () => null);
      await assert.rejects(() => packagePurchaseService.cancelPurchase(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });

  describe("deletePurchase", () => {
    it("throws 404 for a nonexistent purchase", async (t) => {
      t.mock.method(packagePurchaseRepo, "findPackagePurchaseById", async () => null);
      await assert.rejects(() => packagePurchaseService.deletePurchase(id().toString(), id().toString()), (err) => err.statusCode === 404);
    });
  });
});