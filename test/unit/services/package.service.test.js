import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import packageRepo from "../../../src/repositories/package.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import * as packageService from "../../../src/services/package.service.js";
import { buildPackage, buildService, buildServicePackageVariant, id } from "../../helpers/factories.js";

// deletePackageById wraps its auto-cleanup + delete in a real Mongo transaction -
// faking the session lets this run as a pure unit test instead of needing a
// replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

describe("package.service", () => {
  describe("createPackage - item validation", () => {
    it("rejects a package with no items", async () => {
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an item with fewer than 1 session", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [{ service: id(), servicePackageId: id(), sessions: 0 }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an item with no service selected", async () => {
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [{ servicePackageId: id(), sessions: 1 }] }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createPackage - variant scoping", () => {
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

  describe("createPackage - slug generation", () => {
    it("auto-generates a slug from the name when omitted", async (t) => {
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

      assert.equal(created.slug, "dan-za-sebe");
    });

    it("rejects an explicit slug that's already taken", async (t) => {
      const variant = buildServicePackageVariant();
      const service = buildService({ packages: [variant] });
      t.mock.method(serviceRepo, "findServiceById", async () => service);
      t.mock.method(packageRepo, "findPackageBySlug", async () => buildPackage({ slug: "zauzeto" }));
      await assert.rejects(
        () =>
          packageService.createPackage({
            name: "X",
            slug: "zauzeto",
            totalPrice: 1000,
            items: [{ service: service._id.toString(), servicePackageId: variant._id.toString(), sessions: 1 }],
          }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("getPackageBySlug", () => {
    it("treats an inactive package as not found publicly", async (t) => {
      t.mock.method(packageRepo, "findPackageBySlug", async () => buildPackage({ isActive: false }));
      await assert.rejects(() => packageService.getPackageBySlug("neaktivan"), (err) => err.statusCode === 404);
    });
  });

  describe("updatePackageById", () => {
    it("throws 404 for a nonexistent package", async (t) => {
      t.mock.method(packageRepo, "findPackageById", async () => null);
      await assert.rejects(() => packageService.updatePackageById("missing", {}), (err) => err.statusCode === 404);
    });
  });

  describe("deletePackageById", () => {
    it("throws 404 for a nonexistent package", async (t) => {
      t.mock.method(packageRepo, "findPackageById", async () => null);
      await assert.rejects(() => packageService.deletePackageById("missing"), (err) => err.statusCode === 404);
    });

    it("deletes a package with no purchases, pulling it from Coupon", async (t) => {
      mockSession(t);
      t.mock.method(packageRepo, "findPackageById", async () => buildPackage());
      t.mock.method(packageRepo, "deletePackageById", async () => true);
      t.mock.method(packagePurchaseRepo, "countPackagePurchases", async () => 0);

      let couponPullCalls = 0;
      t.mock.method(couponRepo, "pullPackageFromAllCoupons", async () => { couponPullCalls++; });

      const result = await packageService.deletePackageById(id().toString());

      assert.equal(result.success, true);
      assert.equal(couponPullCalls, 1);
    });

    it("refuses to delete a package with any purchase, even a completed/expired one", async (t) => {
      // Unlike Service, PackagePurchase.package has no name snapshot of the package -
      // so this blocks regardless of purchase status, not just active ones.
      t.mock.method(packageRepo, "findPackageById", async () => buildPackage());
      t.mock.method(packagePurchaseRepo, "countPackagePurchases", async () => 1);

      await assert.rejects(() => packageService.deletePackageById(id().toString()), (err) => err.statusCode === 400);
    });
  });
});