import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapServicesForAdminList,
  mapServiceForAdminDetail,
  mapServiceForEdit,
  mapServiceForPublicCard,
  mapServiceForPublicDetail,
} from "../../../src/mappers/service.mapper.js";
import { buildService, buildServicePackageVariant, id } from "../../helpers/factories.js";

describe("service.mapper", () => {
  describe("price range", () => {
    it("shows a single price when all active packages cost the same", () => {
      const service = buildService({ packages: [buildServicePackageVariant({ totalPrice: 2000 }), buildServicePackageVariant({ totalPrice: 2000 })] });
      assert.equal(mapServiceForPublicCard(service).cena, "2000 RSD");
    });

    it("shows a range when prices differ", () => {
      const service = buildService({ packages: [buildServicePackageVariant({ totalPrice: 1000 }), buildServicePackageVariant({ totalPrice: 3000 })] });
      assert.equal(mapServiceForPublicCard(service).cena, "1000 - 3000 RSD");
    });

    it("ignores inactive packages when computing the range", () => {
      const service = buildService({
        packages: [buildServicePackageVariant({ totalPrice: 1000, isActive: true }), buildServicePackageVariant({ totalPrice: 9999, isActive: false })],
      });
      assert.equal(mapServiceForPublicCard(service).cena, "1000 RSD");
    });

    it("returns null when there are no active packages", () => {
      const service = buildService({ packages: [buildServicePackageVariant({ isActive: false })] });
      assert.equal(mapServiceForPublicCard(service).cena, null);
    });
  });

  describe("public detail package/feature filtering - a real inconsistency worth knowing about", () => {
    it("mapFeatures (used by public detail) DOES filter to active-only features", () => {
      const service = buildService({
        features: [{ name: "Aktivna", isActive: true }, { name: "Neaktivna", isActive: false }],
      });
      const mapped = mapServiceForPublicDetail(service);
      assert.equal(mapped.karakteristike.length, 1);
      assert.equal(mapped.karakteristike[0].naziv, "Aktivna");
    });

    it("mapPackages (used by the same public detail function) does NOT filter by isActive - every package/variant is included regardless, with 'aktivan' left for the template to check", () => {
      const service = buildService({
        packages: [buildServicePackageVariant({ isActive: true }), buildServicePackageVariant({ isActive: false })],
      });
      const mapped = mapServiceForPublicDetail(service);
      assert.equal(mapped.varijante.length, 2, "unlike features, inactive packages are NOT filtered out here - inconsistent with mapFeatures above");
    });

    it("mapServiceForAdminDetail includes inactive packages too (admin needs to see and re-enable them)", () => {
      const service = buildService({
        packages: [buildServicePackageVariant({ isActive: true }), buildServicePackageVariant({ isActive: false })],
      });
      const mapped = mapServiceForAdminDetail(service);
      assert.equal(mapped.varijante.length, 2);
    });
  });

  describe("category/tag name extraction", () => {
    it("only includes populated categories/tags with a name", () => {
      const service = buildService({ categories: [{ name: "Masaze" }, id()] });
      const mapped = mapServiceForAdminDetail(service);
      assert.deepEqual(mapped.kategorije, ["Masaze"]);
    });
  });

  describe("mapServiceForEdit - id flattening", () => {
    it("flattens categories/tags to plain id strings", () => {
      const category = { _id: id(), name: "X" };
      const service = buildService({ categories: [category] });
      const mapped = mapServiceForEdit(service);
      assert.equal(mapped.categories[0], category._id.toString());
    });
  });

  describe("faq formatting", () => {
    it("translates question/answer to pitanje/odgovor", () => {
      const service = buildService({ faq: [{ question: "Da li boli?", answer: "Ne." }] });
      const mapped = mapServiceForAdminDetail(service);
      assert.deepEqual(mapped.faq[0], { pitanje: "Da li boli?", odgovor: "Ne." });
    });
  });

  describe("mapServicesForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapServicesForAdminList([buildService(), null]).length, 1);
    });

    it("translates highlight/isActive to Da/Ne", () => {
      const [mapped] = mapServicesForAdminList([buildService({ highlight: true, isActive: false })]);
      assert.equal(mapped.istaknuto, "Da");
      assert.equal(mapped.aktivna, "Ne");
    });
  });

  describe("null safety", () => {
    it("returns null for a null service across every single-item mapper", () => {
      assert.equal(mapServiceForAdminDetail(null), null);
      assert.equal(mapServiceForEdit(null), null);
      assert.equal(mapServiceForPublicCard(null), null);
      assert.equal(mapServiceForPublicDetail(null), null);
    });
  });
});