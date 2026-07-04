import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packageRepo from "../../../../src/repositories/package.repository.js";
import * as packageService from "../../../../src/services/package.service.js";
import { buildPackage, id } from "../../helpers/factories.js";

describe("package.service", () => {
  describe("createPackage — item validation", () => {
    it("rejects a package with no items", async () => {
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an item with fewer than 1 session", async () => {
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [{ service: id(), sessions: 0 }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an item with no service selected", async () => {
      await assert.rejects(
        () => packageService.createPackage({ name: "X", totalPrice: 1000, items: [{ sessions: 1 }] }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createPackage — slug generation", () => {
    it("auto-generates a slug from the name when omitted", async (t) => {
      t.mock.method(packageRepo, "findPackageBySlug", async () => null);
      let payload;
      t.mock.method(packageRepo, "createPackage", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });
      t.mock.method(packageRepo, "findPackageById", async () => payload);

      await packageService.createPackage({ name: "Dan Za Sebe", totalPrice: 8000, items: [{ service: id(), sessions: 1 }] });

      assert.equal(payload.slug, "dan-za-sebe");
    });

    it("rejects an explicit slug that's already taken", async (t) => {
      t.mock.method(packageRepo, "findPackageBySlug", async () => buildPackage({ slug: "zauzeto" }));
      await assert.rejects(
        () => packageService.createPackage({ name: "X", slug: "zauzeto", totalPrice: 1000, items: [{ service: id(), sessions: 1 }] }),
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
});