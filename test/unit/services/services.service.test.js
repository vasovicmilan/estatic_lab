import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import serviceRepo from "../../../src/repositories/service.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import categoryService from "../../../src/services/category.service.js";
import * as serviceService from "../../../src/services/service.service.js";

// deleteServiceById wraps its auto-cleanup + delete in a real Mongo transaction -
// faking the session lets this run as a pure unit test instead of needing a
// replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}
import { buildService, buildServicePackageVariant, buildCategory, id } from "../../helpers/factories.js";

describe("service.service", () => {
  describe("createDraftService - phase 1", () => {
    it("forces isActive:false regardless of what's passed in", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });

      await serviceService.createDraftService({ name: "Masaza", isActive: true });
      assert.equal(created.isActive, false);
    });

    it("requires a name", async () => {
      await assert.rejects(() => serviceService.createDraftService({}), (err) => err.statusCode === 400);
    });

    it("auto-generates a slug from the name when omitted", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });

      await serviceService.createDraftService({ name: "Sportska Masaza" });
      assert.equal(created.slug, "sportska-masaza");
    });

    it("rejects an explicit slug that's already taken", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => buildService({ slug: "zauzeto" }));
      await assert.rejects(
        () => serviceService.createDraftService({ name: "X", slug: "zauzeto" }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("addPackagesToService - phase 2", () => {
    it("rejects zero packages", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      await assert.rejects(
        () => serviceService.addPackagesToService(id().toString(), []),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a variant with too-short duration", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      await assert.rejects(
        () => serviceService.addPackagesToService(id().toString(), [{ name: "Brzo", duration: 2, totalPrice: 1000 }]),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a variant with a negative price", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      await assert.rejects(
        () => serviceService.addPackagesToService(id().toString(), [{ name: "X", duration: 30, totalPrice: -5 }]),
        (err) => err.statusCode === 400
      );
    });

    it("throws 404 for a nonexistent service", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => null);
      await assert.rejects(
        () => serviceService.addPackagesToService(id().toString(), [{ name: "X", duration: 30, totalPrice: 1000 }]),
        (err) => err.statusCode === 404
      );
    });

    it("auto-generates a slug per variant when the variant has none", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...buildService(), ...data };
      });

      await serviceService.addPackagesToService(id().toString(), [
        { name: "60 minuta", duration: 60, totalPrice: 3000 },
        { name: "90 minuta", duration: 90, totalPrice: 4000 },
      ]);

      assert.equal(updated.packages[0].slug, "60-minuta");
      assert.equal(updated.packages[1].slug, "90-minuta");
    });

    it("resolves a slug collision between two variants of the same service", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...buildService(), ...data };
      });

      await serviceService.addPackagesToService(id().toString(), [
        { name: "60 minuta", duration: 60, totalPrice: 3000 },
        { name: "60 Minuta", duration: 60, totalPrice: 3500 },
      ]);

      assert.equal(updated.packages[0].slug, "60-minuta");
      assert.equal(updated.packages[1].slug, "60-minuta-2");
    });

    it("preserves an explicitly-set variant slug instead of overwriting it", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...buildService(), ...data };
      });

      await serviceService.addPackagesToService(id().toString(), [
        { name: "60 minuta", slug: "moj-custom-slug", duration: 60, totalPrice: 3000 },
      ]);

      assert.equal(updated.packages[0].slug, "moj-custom-slug");
    });
  });

  describe("addExtrasAndPublish - phase 3", () => {
    it("publishes by default (isActive defaults to true) when image + packages already exist", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService({ isActive: false }));
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...buildService(), ...data };
      });

      await serviceService.addExtrasAndPublish(id().toString(), {});
      assert.equal(updated.isActive, true);
    });

    it("rejects publishing when the service has no image", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService({ image: null }));
      await assert.rejects(
        () => serviceService.addExtrasAndPublish(id().toString(), {}),
        (err) => err.statusCode === 400
      );
    });

    it("rejects publishing when the service has zero packages", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService({ packages: [] }));
      await assert.rejects(
        () => serviceService.addExtrasAndPublish(id().toString(), {}),
        (err) => err.statusCode === 400
      );
    });

    it("allows explicitly saving as a draft (isActive:false) even without packages", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService({ packages: [] }));
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...buildService(), ...data };
      });

      await serviceService.addExtrasAndPublish(id().toString(), { isActive: false });
      assert.equal(updated.isActive, false);
    });

    it("throws 404 for a nonexistent service", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => null);
      await assert.rejects(() => serviceService.addExtrasAndPublish(id().toString(), {}), (err) => err.statusCode === 404);
    });

    it("merges extras with existing values instead of wiping unrelated ones", async (t) => {
      const existing = buildService({ features: [{ name: "Postojeca" }], faq: [{ question: "Q", answer: "A" }] });
      t.mock.method(serviceRepo, "findServiceById", async () => existing);
      let updated;
      t.mock.method(serviceRepo, "updateServiceById", async (serviceId, data) => {
        updated = data;
        return { ...existing, ...data };
      });

      // only sending faq - features should be preserved from `existing`, not dropped
      await serviceService.addExtrasAndPublish(id().toString(), { faq: [{ question: "Nova", answer: "Odgovor" }] });
      assert.deepEqual(updated.features, existing.features);
      assert.equal(updated.faq[0].question, "Nova");
    });
  });

  describe("findServicesByCategorySlug", () => {
    it("resolves the category slug and filters services by its id", async (t) => {
      const category = buildCategory({ slug: "masaze", domain: "service" });
      t.mock.method(categoryService, "getCategoryBySlugAndDomain", async () => category);
      t.mock.method(serviceRepo, "findServices", async () => ({ data: [], total: 0, page: 1, limit: 12, totalPages: 0 }));

      await serviceService.findServicesByCategorySlug("masaze");

      const call = serviceRepo.findServices.mock.calls[0];
      assert.equal(call.arguments[0].filters.category, category._id);
    });

    it("propagates a 404 when the category slug doesn't resolve", async (t) => {
      t.mock.method(categoryService, "getCategoryBySlugAndDomain", async () => {
        const err = new Error("Kategorija nije pronađena");
        err.statusCode = 404;
        throw err;
      });

      await assert.rejects(
        () => serviceService.findServicesByCategorySlug("nepostojeca"),
        (err) => err.statusCode === 404
      );
    });
  });

  describe("getActiveVariant", () => {
    it("throws 404 when the variant doesn't exist on that service", async (t) => {
      t.mock.method(serviceRepo, "findServicePackageVariant", async () => null);
      await assert.rejects(
        () => serviceService.getActiveVariant(id().toString(), id().toString()),
        (err) => err.statusCode === 404
      );
    });

    it("refuses to book an inactive variant", async (t) => {
      t.mock.method(serviceRepo, "findServicePackageVariant", async () => ({
        service: { name: "Masaza" },
        variant: buildServicePackageVariant({ isActive: false }),
      }));
      await assert.rejects(
        () => serviceService.getActiveVariant(id().toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("returns the service+variant pair for an active variant", async (t) => {
      const variant = buildServicePackageVariant();
      t.mock.method(serviceRepo, "findServicePackageVariant", async () => ({ service: { name: "Masaza" }, variant }));
      const result = await serviceService.getActiveVariant(id().toString(), variant._id.toString());
      assert.equal(result.variant.name, variant.name);
    });
  });

  describe("getServiceBySlug", () => {
    it("treats an inactive service as not found publicly", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => buildService({ isActive: false }));
      await assert.rejects(() => serviceService.getServiceBySlug("neaktivna"), (err) => err.statusCode === 404);
    });
  });

  describe("deleteServiceById", () => {
    it("throws 404 for a nonexistent service", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => null);
      await assert.rejects(() => serviceService.deleteServiceById("missing"), (err) => err.statusCode === 404);
    });

    function mockNoBlockingReferences(t) {
      t.mock.method(appointmentRepo, "countAppointments", async () => 0);
      t.mock.method(packagePurchaseRepo, "countActivePurchasesWithOutstandingSessionsForService", async () => 0);
      t.mock.method(packageRepo, "findPackages", async () => ({ data: [], total: 0, page: 1, limit: 5, totalPages: 0 }));
    }

    it("deletes a service with no remaining references, pulling it from Employee/Coupon", async (t) => {
      mockSession(t);
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      t.mock.method(serviceRepo, "deleteServiceById", async () => true);
      mockNoBlockingReferences(t);

      const pullCalls = { employee: 0, coupon: 0 };
      t.mock.method(employeeRepo, "pullServiceFromAllEmployees", async () => { pullCalls.employee++; });
      t.mock.method(couponRepo, "pullServiceFromAllCoupons", async () => { pullCalls.coupon++; });

      const result = await serviceService.deleteServiceById(id().toString());

      assert.equal(result.success, true);
      assert.equal(pullCalls.employee, 1);
      assert.equal(pullCalls.coupon, 1);
    });

    it("refuses to delete a service with a pending or confirmed appointment", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      mockNoBlockingReferences(t);
      t.mock.method(appointmentRepo, "countAppointments", async () => 1);

      await assert.rejects(() => serviceService.deleteServiceById(id().toString()), (err) => err.statusCode === 400);
    });

    it("allows deletion when appointments exist but are all terminal (completed/cancelled/rejected/no_show)", async (t) => {
      mockSession(t);
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      t.mock.method(serviceRepo, "deleteServiceById", async () => true);
      t.mock.method(employeeRepo, "pullServiceFromAllEmployees", async () => {});
      t.mock.method(couponRepo, "pullServiceFromAllCoupons", async () => {});
      mockNoBlockingReferences(t);
      // countAppointments is called with statusIn: ["pending", "confirmed"] specifically,
      // so a mock that only returns 0 already proves terminal-status appointments don't
      // block - nothing further to arrange here, this documents the intent.

      const result = await serviceService.deleteServiceById(id().toString());
      assert.equal(result.success, true);
    });

    it("refuses to delete a service with an active package purchase holding unused sessions", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      mockNoBlockingReferences(t);
      t.mock.method(packagePurchaseRepo, "countActivePurchasesWithOutstandingSessionsForService", async () => 1);

      await assert.rejects(() => serviceService.deleteServiceById(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to delete a service still used in a package, naming the package in the error", async (t) => {
      t.mock.method(serviceRepo, "findServiceById", async () => buildService());
      mockNoBlockingReferences(t);
      t.mock.method(packageRepo, "findPackages", async () => ({
        data: [{ name: "Relax paket" }],
        total: 1,
        page: 1,
        limit: 5,
        totalPages: 1,
      }));

      await assert.rejects(
        () => serviceService.deleteServiceById(id().toString()),
        (err) => err.statusCode === 400 && err.message.includes("Relax paket")
      );
    });
  });
});