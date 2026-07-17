import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as dbHandler from "../setup/db-handler.js";

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
    it("persists a fully-published service (image + packages + isActive:true)", async () => {
      const service = await serviceRepo.createService(validService({ isActive: true }));
      assert.ok(service._id);
      assert.equal(service.packages.length, 1);
      assert.equal(service.isActive, true);
    });

    // image/packages are no longer unconditionally required - a 3-phase draft can
    // now be saved with neither, as long as isActive stays at its default (false).
    it("persists a draft (isActive:false) service with no image and no packages", async () => {
      const service = await serviceRepo.createService({ name: "Nova Usluga U Izradi", slug: "nova-usluga-u-izradi" });
      assert.ok(service._id);
      assert.equal(service.isActive, false);
      assert.equal(service.packages.length, 0);
      assert.equal(service.image, undefined);
    });

    it("rejects creating with isActive:true and no image", async () => {
      await assert.rejects(() => serviceRepo.createService(validService({ isActive: true, image: undefined })));
    });

    it("rejects creating with isActive:true and zero packages", async () => {
      await assert.rejects(() => serviceRepo.createService(validService({ isActive: true, packages: [] })));
    });

    it("rejects a duplicate slug (unique index)", async () => {
      await serviceRepo.createService(validService());
      await assert.rejects(() => serviceRepo.createService(validService({ name: "Druga usluga" })));
    });

    it("rejects a mismatched comparisonTable row length on create", async () => {
      await assert.rejects(() =>
        serviceRepo.createService(
          validService({
            comparisonColumns: ["Osnovno", "Premium"],
            comparisonTable: [{ label: "Trajanje", values: ["60 min"] }], // needs 2 values, has 1
          })
        )
      );
    });
  });

  describe("updateServiceById - publish invariants via pre('findOneAndUpdate')", () => {
    it("allows a draft update that clears packages while isActive stays false", async () => {
      const created = await serviceRepo.createService(validService());
      const updated = await serviceRepo.updateServiceById(created._id, { packages: [] });
      assert.equal(updated.packages.length, 0);
    });

    it("rejects flipping isActive to true via update when packages is empty", async () => {
      const created = await serviceRepo.createService(validService({ packages: [] }));
      await assert.rejects(() => serviceRepo.updateServiceById(created._id, { isActive: true }));
    });

    it("rejects flipping isActive to true via update when there's no image", async () => {
      const created = await serviceRepo.createService({
        name: "Bez Slike",
        slug: "bez-slike",
        packages: validService().packages,
      });
      await assert.rejects(() => serviceRepo.updateServiceById(created._id, { isActive: true }));
    });

    it("allows flipping isActive to true once image and packages are both present", async () => {
      const created = await serviceRepo.createService(validService());
      const updated = await serviceRepo.updateServiceById(created._id, { isActive: true });
      assert.equal(updated.isActive, true);
    });

    // this is the pre-existing bug the new findOneAndUpdate hook fixes: this check
    // used to only run inside pre('save'), which findByIdAndUpdate never triggers -
    // so a mismatched comparisonTable could previously be saved via any update.
    it("rejects a mismatched comparisonTable row length on update (previously not checked at all)", async () => {
      const created = await serviceRepo.createService(validService({ comparisonColumns: ["Osnovno", "Premium"] }));
      await assert.rejects(() =>
        serviceRepo.updateServiceById(created._id, {
          comparisonTable: [{ label: "Trajanje", values: ["60 min"] }],
        })
      );
    });

    it("leaves invariant checks alone for updates that don't touch any relevant field", async () => {
      const created = await serviceRepo.createService(validService({ isActive: true }));
      const updated = await serviceRepo.updateServiceById(created._id, { shortDescription: "Novi kratak opis" });
      assert.equal(updated.shortDescription, "Novi kratak opis");
    });
  });
});