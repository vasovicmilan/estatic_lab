import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packageRepo from "../../../src/repositories/package.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as packageService from "../../../src/services/package.service.js";
import { buildPackage, buildService, buildServicePackageVariant, id } from "../../helpers/factories.js";

describe("package.service", () => {
  describe("createPackage — item validation", () => {
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

  describe("createPackage — slug generation", () => {
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
});