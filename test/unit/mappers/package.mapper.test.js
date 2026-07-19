import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapPackagesForAdminList,
  mapPackageForAdminDetail,
  mapPackageForEdit,
  mapPackageForPublicCard,
  mapPackageForPublicDetail,
} from "../../../src/mappers/package.mapper.js";
import { buildPackage, id } from "../../helpers/factories.js";

describe("package.mapper", () => {
  describe("item/variant resolution", () => {
    it("resolves the populated service name and matching variant", () => {
      const variantId = id();
      const pkg = buildPackage({
        items: [
          {
            service: { _id: id(), name: "Klasicna masaza", slug: "klasicna-masaza", packages: [{ _id: variantId, name: "60 min", totalPrice: 3000 }] },
            servicePackageId: variantId,
            sessions: 5,
          },
        ],
      });
      const mapped = mapPackageForAdminDetail(pkg);
      assert.equal(mapped.stavke[0].usluga.naziv, "Klasicna masaza");
      assert.equal(mapped.stavke[0].varijanta.naziv, "60 min");
      assert.equal(mapped.stavke[0].brojSeansi, 5);
    });

    it("does not crash when service is null, and falls back gracefully", () => {
      const pkg = buildPackage({ items: [{ service: null, servicePackageId: id(), sessions: 2 }] });
      // should NOT throw
      const mapped = mapPackageForAdminDetail(pkg);
      assert.equal(mapped.stavke[0].usluga.id, undefined);
    });

    it("falls back to the raw id when service isn't populated", () => {
      const serviceId = id();
      const pkg = buildPackage({ items: [{ service: serviceId, servicePackageId: id(), sessions: 1 }] });
      const mapped = mapPackageForAdminDetail(pkg);
      assert.equal(mapped.stavke[0].usluga.id, serviceId.toString());
    });

    it("getItemsSummary (used on the list/card views) only excludes a null/missing service, not merely-unpopulated ones", () => {
      const pkg = buildPackage({
        items: [
          { service: { name: "Masaza", packages: [] }, servicePackageId: id(), sessions: 3 },
          { service: null, servicePackageId: id(), sessions: 1 },
        ],
      });
      const [mapped] = mapPackagesForAdminList([pkg]);
      assert.equal(mapped.stavke.length, 1, "only the null-service item should be omitted");
      assert.match(mapped.stavke[0], /Masaza/);
    });
  });

  describe("pricing display", () => {
    it("shows staraCena (compare-at price) only when basePrice is set", () => {
      const withCompare = mapPackageForPublicCard(buildPackage({ basePrice: 5000, totalPrice: 4000 }));
      assert.equal(withCompare.staraCena, "5000 RSD");

      const withoutCompare = mapPackageForPublicCard(buildPackage({ basePrice: null }));
      assert.equal(withoutCompare.staraCena, null);
    });
  });

  describe("faq formatting", () => {
    it("translates question/answer to pitanje/odgovor", () => {
      const pkg = buildPackage({ faq: [{ question: "Koliko traje?", answer: "60 minuta." }] });
      const mapped = mapPackageForAdminDetail(pkg);
      assert.deepEqual(mapped.faq[0], { pitanje: "Koliko traje?", odgovor: "60 minuta." });
    });
  });

  describe("mapPackageForEdit - id flattening", () => {
    it("flattens categories/tags to plain id strings regardless of population", () => {
      const category = { _id: id(), name: "X" };
      const rawTag = id();
      const pkg = buildPackage({ categories: [category], tags: [rawTag] });
      const mapped = mapPackageForEdit(pkg);
      assert.equal(mapped.categories[0], category._id.toString());
      assert.equal(mapped.tags[0], rawTag.toString());
    });
  });

  describe("public detail vs admin detail", () => {
    it("public detail omits internal admin fields like order/isActive", () => {
      const mapped = mapPackageForPublicDetail(buildPackage());
      assert.ok(!("order" in mapped));
      assert.ok(!("isActive" in mapped));
    });
  });

  describe("mapPackagesForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapPackagesForAdminList([buildPackage(), null]).length, 1);
    });

    it("translates isBest/isActive to Da/Ne", () => {
      const [mapped] = mapPackagesForAdminList([buildPackage({ isBest: true, isActive: false })]);
      assert.equal(mapped.najbolji, "Da");
      assert.equal(mapped.aktivan, "Ne");
    });
  });

  describe("null safety", () => {
    it("returns null for a null package across every single-item mapper", () => {
      assert.equal(mapPackageForAdminDetail(null), null);
      assert.equal(mapPackageForEdit(null), null);
      assert.equal(mapPackageForPublicCard(null), null);
      assert.equal(mapPackageForPublicDetail(null), null);
    });
  });
});