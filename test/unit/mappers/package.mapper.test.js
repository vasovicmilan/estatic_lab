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

    it("does not crash when service is null, and shows a placeholder rather than dropping the item", () => {
      const pkg = buildPackage({ items: [{ service: null, servicePackageId: id(), sessions: 2 }] });
      // should NOT throw
      const mapped = mapPackageForAdminDetail(pkg);
      assert.equal(mapped.stavke[0].usluga.id, null);
      assert.equal(mapped.stavke[0].usluga.naziv, "Usluga obrisana");
    });

    it("falls back to the raw id when service isn't populated", () => {
      const serviceId = id();
      const pkg = buildPackage({ items: [{ service: serviceId, servicePackageId: id(), sessions: 1 }] });
      const mapped = mapPackageForAdminDetail(pkg);
      assert.equal(mapped.stavke[0].usluga.id, serviceId.toString());
      assert.equal(mapped.stavke[0].usluga.naziv, "Usluga nije učitana");
    });

    it("getItemsSummary (used on the list/card views) never drops an item, even when its service is null - a dropped item made the package look like it had fewer things in it than it's actually priced for", () => {
      const pkg = buildPackage({
        items: [
          { service: { name: "Masaza", packages: [] }, servicePackageId: id(), sessions: 3 },
          { service: null, servicePackageId: id(), sessions: 1 },
        ],
      });
      const [mapped] = mapPackagesForAdminList([pkg]);
      assert.equal(mapped.stavke.length, 2, "both items should be shown, not just the populated one");
      assert.match(mapped.stavke[0], /Masaza/);
      assert.match(mapped.stavke[1], /Usluga obrisana/);
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

  // BUG FIX regression tests - see buildGroupKey's own comment in
  // package.mapper.js. Two or more packages with an unresolved service
  // reference used to all fall back to the exact same "nepoznato:..." group
  // key, silently merging unrelated packages into a single
  // groupPackagesByTreatment() card - every package but one effectively
  // vanished from /paketi with no error anywhere.
  describe("grupa (group key) - never collides between two unrelated broken packages", () => {
    it("falls back to the package's own _id when item.service is entirely missing, not a shared generic string", () => {
      const pkgA = buildPackage({ items: [{ service: null, servicePackageId: id(), sessions: 5 }] });
      const pkgB = buildPackage({ items: [{ service: null, servicePackageId: id(), sessions: 5 }] });

      const mappedA = mapPackageForPublicCard(pkgA);
      const mappedB = mapPackageForPublicCard(pkgB);

      assert.notEqual(mappedA.grupa, mappedB.grupa, "two different packages with a missing service reference must never collide on the same group key");
      assert.match(mappedA.grupa, /standalone:/);
    });

    it("falls back to the package's own _id when servicePackageId is missing, even if the service itself resolves fine", () => {
      const sharedServiceId = id();
      const pkgA = buildPackage({ items: [{ service: sharedServiceId, servicePackageId: null, sessions: 5 }] });
      const pkgB = buildPackage({ items: [{ service: sharedServiceId, servicePackageId: null, sessions: 10 }] });

      const mappedA = mapPackageForPublicCard(pkgA);
      const mappedB = mapPackageForPublicCard(pkgB);

      assert.notEqual(mappedA.grupa, mappedB.grupa, "must not collide just because both happen to reference the same (real) service with a missing variant id");
    });

    it("still correctly groups two legitimate tiers of the SAME service+variant together - the fix doesn't break the intended pairing", () => {
      const sharedServiceId = id();
      const sharedVariantId = id();
      const pkg5 = buildPackage({ items: [{ service: sharedServiceId, servicePackageId: sharedVariantId, sessions: 5 }] });
      const pkg10 = buildPackage({ items: [{ service: sharedServiceId, servicePackageId: sharedVariantId, sessions: 10 }] });

      const mapped5 = mapPackageForPublicCard(pkg5);
      const mapped10 = mapPackageForPublicCard(pkg10);

      assert.equal(mapped5.grupa, mapped10.grupa, "two real tiers of the same service+variant must still share a group key so they render as one card with a toggle");
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