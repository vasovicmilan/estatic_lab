import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import serviceRepo from "../../../src/repositories/service.repository.js";

function validService(overrides = {}) {
  return {
    name: "Sportska Masaza",
    slug: "sportska-masaza",
    image: { img: "/images/services/masaza.webp", imgDesc: "Sportska masaza" },
    packages: [{ name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000 }],
    ...overrides,
  };
}

describe("service.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createService", () => {
    it("persists a service with at least one package variant", async () => {
      const service = await serviceRepo.createService(validService());
      assert.ok(service._id);
      assert.equal(service.packages.length, 1);
    });

    it("rejects a service with zero packages at the schema level", async () => {
      await assert.rejects(() => serviceRepo.createService(validService({ packages: [] })));
    });

    it("rejects a duplicate slug (unique index)", async () => {
      await serviceRepo.createService(validService());
      await assert.rejects(() => serviceRepo.createService(validService({ name: "Druga usluga" })));
    });

    it("rejects a mismatched comparisonTable row length via the pre-save hook", async () => {
      await assert.rejects(() =>
        serviceRepo.createService(
          validService({
            comparisonColumns: ["30 min", "60 min"],
            comparisonTable: [{ label: "Cena", values: ["1000"] }],
          })
        )
      );
    });

    it("rejects an image missing the required imgDesc field", async () => {
      await assert.rejects(() =>
        serviceRepo.createService(validService({ image: { img: "/images/services/masaza.webp" } }))
      );
    });
    
    it("accepts a matching comparisonTable row length", async () => {
      const service = await serviceRepo.createService(
        validService({
          comparisonColumns: ["30 min", "60 min"],
          comparisonTable: [{ label: "Cena", values: ["1000", "2000"] }],
        })
      );
      assert.ok(service._id);
    });
  });

  describe("findServiceById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await serviceRepo.findServiceById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findServiceBySlug", () => {
    it("finds a service by its slug", async () => {
      await serviceRepo.createService(validService());
      const found = await serviceRepo.findServiceBySlug("sportska-masaza");
      assert.ok(found);
    });

    it("returns null for a nonexistent slug", async () => {
      const found = await serviceRepo.findServiceBySlug("ne-postoji");
      assert.equal(found, null);
    });
  });

  describe("findServicePackageVariant", () => {
    it("returns the service and the matching variant only", async () => {
      const created = await serviceRepo.createService(
        validService({
          packages: [
            { name: "60 minuta", slug: "60-minuta", duration: 60, totalPrice: 3000 },
            { name: "90 minuta", slug: "90-minuta", duration: 90, totalPrice: 4000 },
          ],
        })
      );
      const variantId = created.packages[1]._id;

      const result = await serviceRepo.findServicePackageVariant(created._id, variantId);

      assert.equal(result.variant.name, "90 minuta");
      assert.equal(result.service.name, "Sportska Masaza");
    });

    it("returns null when the service or variant doesn't exist", async () => {
      const result = await serviceRepo.findServicePackageVariant(new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId());
      assert.equal(result, null);
    });
  });

  describe("findServices", () => {
    it("filters by isActive", async () => {
      await serviceRepo.createService(validService({ slug: "aktivna", isActive: true }));
      await serviceRepo.createService(validService({ slug: "neaktivna", isActive: false }));

      const result = await serviceRepo.findServices({ filters: { isActive: true }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "aktivna");
    });

    it("searches by name", async () => {
      await serviceRepo.createService(validService({ name: "Relax Masaza", slug: "relax" }));
      await serviceRepo.createService(validService({ name: "Sportska Masaza", slug: "sport" }));

      const result = await serviceRepo.findServices({ search: "Relax", populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "relax");
    });

    it("filters by highlight", async () => {
      await serviceRepo.createService(validService({ slug: "istaknuta", highlight: true }));
      await serviceRepo.createService(validService({ slug: "obicna", highlight: false }));

      const result = await serviceRepo.findServices({ filters: { highlight: true }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "istaknuta");
    });
  });

  describe("updateServiceById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await serviceRepo.createService(validService());
      const updated = await serviceRepo.updateServiceById(created._id, { name: "Novo Ime" });
      assert.equal(updated.name, "Novo Ime");
    });
  });

  describe("deleteServiceById", () => {
    it("deletes the service", async () => {
      const created = await serviceRepo.createService(validService());
      await serviceRepo.deleteServiceById(created._id);
      const found = await serviceRepo.findServiceById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countServices", () => {
    it("counts services matching a filter", async () => {
      await serviceRepo.createService(validService({ slug: "a", isActive: true }));
      await serviceRepo.createService(validService({ slug: "b", isActive: false }));

      const count = await serviceRepo.countServices({ isActive: true });

      assert.equal(count, 1);
    });
  });
});