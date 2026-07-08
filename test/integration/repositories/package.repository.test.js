import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import packageRepo from "../../../src/repositories/package.repository.js";

function validPackage(overrides = {}) {
  return {
    name: "Dan Za Sebe",
    slug: "dan-za-sebe",
    description: "Kombinovani paket usluga",
    items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessions: 1 }],
    totalPrice: 8000,
    ...overrides,
  };
}

describe("package.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createPackage", () => {
    it("persists a package", async () => {
      const pkg = await packageRepo.createPackage(validPackage());
      assert.ok(pkg._id);
      assert.equal(pkg.items.length, 1);
    });

    it("rejects a package with no items at the schema level", async () => {
      await assert.rejects(() => packageRepo.createPackage(validPackage({ items: [] })));
    });

    it("rejects an item missing servicePackageId at the schema level", async () => {
      await assert.rejects(() =>
        packageRepo.createPackage(validPackage({ items: [{ service: new mongoose.Types.ObjectId(), sessions: 1 }] }))
      );
    });

    it("rejects a duplicate slug (unique index)", async () => {
      await packageRepo.createPackage(validPackage());
      await assert.rejects(() => packageRepo.createPackage(validPackage({ name: "Drugi paket" })));
    });

    it("accepts a package with no image at all (image is optional)", async () => {
      const pkg = await packageRepo.createPackage(validPackage());
      assert.equal(pkg.image, undefined);
    });

    it("rejects an image missing the required imgDesc field when one is provided", async () => {
      await assert.rejects(() =>
        packageRepo.createPackage(validPackage({ image: { img: "/images/packages/dan.webp" } }))
      );
    });
  });

  describe("findPackageById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await packageRepo.findPackageById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findPackageBySlug", () => {
    it("finds a package by its slug", async () => {
      await packageRepo.createPackage(validPackage());
      const found = await packageRepo.findPackageBySlug("dan-za-sebe");
      assert.ok(found);
    });

    it("returns null for a nonexistent slug", async () => {
      const found = await packageRepo.findPackageBySlug("ne-postoji");
      assert.equal(found, null);
    });
  });

  describe("findPackages", () => {
    it("filters by isActive", async () => {
      await packageRepo.createPackage(validPackage({ slug: "aktivan", isActive: true }));
      await packageRepo.createPackage(validPackage({ slug: "neaktivan", isActive: false }));

      const result = await packageRepo.findPackages({ filters: { isActive: true }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "aktivan");
    });
  });

  describe("updatePackageById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await packageRepo.createPackage(validPackage());
      const updated = await packageRepo.updatePackageById(created._id, { name: "Novi naziv" });
      assert.equal(updated.name, "Novi naziv");
    });
  });

  describe("deletePackageById", () => {
    it("deletes the package", async () => {
      const created = await packageRepo.createPackage(validPackage());
      await packageRepo.deletePackageById(created._id);
      const found = await packageRepo.findPackageById(created._id);
      assert.equal(found, null);
    });
  });
});