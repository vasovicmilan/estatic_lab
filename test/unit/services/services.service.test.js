import { describe, it } from "node:test";
import assert from "node:assert/strict";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as serviceService from "../../../src/services/service.service.js";
import { buildService, buildServicePackageVariant, id } from "../../helpers/factories.js";

describe("service.service", () => {
  describe("createService — package/variant validation", () => {
    it("rejects a service with zero variants", async () => {
      await assert.rejects(
        () => serviceService.createService({ name: "X", image: { img: "/x.webp" }, packages: [] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a variant with too-short duration", async () => {
      await assert.rejects(
        () =>
          serviceService.createService({
            name: "X",
            image: { img: "/x.webp" },
            packages: [{ name: "Brzo", duration: 2, totalPrice: 1000 }],
          }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a variant with a negative price", async () => {
      await assert.rejects(
        () =>
          serviceService.createService({
            name: "X",
            image: { img: "/x.webp" },
            packages: [{ name: "X", duration: 30, totalPrice: -5 }],
          }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createService — slug generation", () => {
    it("auto-generates the service slug from its name", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(serviceRepo, "findServiceById", async () => created);

      await serviceService.createService({
        name: "Sportska Masaza",
        image: { img: "/x.webp" },
        packages: [buildServicePackageVariant({ name: "60 min" })],
      });

      assert.equal(created.slug, "sportska-masaza");
    });

    it("auto-generates a slug per variant when the variant has none", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(serviceRepo, "findServiceById", async () => created);

      await serviceService.createService({
        name: "Masaza",
        image: { img: "/x.webp" },
        packages: [
          { name: "60 minuta", duration: 60, totalPrice: 3000 },
          { name: "90 minuta", duration: 90, totalPrice: 4000 },
        ],
      });

      assert.equal(created.packages[0].slug, "60-minuta");
      assert.equal(created.packages[1].slug, "90-minuta");
    });

    it("resolves a slug collision BETWEEN two variants of the same service", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(serviceRepo, "findServiceById", async () => created);

      // two variants that would both slugify to "60-minuta"
      await serviceService.createService({
        name: "Masaza",
        image: { img: "/x.webp" },
        packages: [
          { name: "60 minuta", duration: 60, totalPrice: 3000 },
          { name: "60 Minuta", duration: 60, totalPrice: 3500 }, // same slug, different price tier
        ],
      });

      assert.equal(created.packages[0].slug, "60-minuta");
      assert.equal(created.packages[1].slug, "60-minuta-2");
    });

    it("preserves an explicitly-set variant slug instead of overwriting it", async (t) => {
      t.mock.method(serviceRepo, "findServiceBySlug", async () => null);
      let created;
      t.mock.method(serviceRepo, "createService", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(serviceRepo, "findServiceById", async () => created);

      await serviceService.createService({
        name: "Masaza",
        image: { img: "/x.webp" },
        packages: [{ name: "60 minuta", slug: "moj-custom-slug", duration: 60, totalPrice: 3000 }],
      });

      assert.equal(created.packages[0].slug, "moj-custom-slug");
    });
  });

  describe("getActiveVariant", () => {
    it("throws 404 when the variant doesn't exist on that service", async (t) => {
      t.mock.method(serviceRepo, "findServicePackageVariant", async () => null);
      await assert.rejects(() => serviceService.getActiveVariant(id().toString(), id().toString()), (err) => err.statusCode === 404);
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
  });
});