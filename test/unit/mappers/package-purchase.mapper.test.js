import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapPackagePurchasesForAdminList, mapPackagePurchaseForAdminDetail } from "../../../src/mappers/package-purchase.mapper.js";
import { buildPackagePurchase, buildUser, id } from "../../helpers/factories.js";

describe("package-purchase.mapper", () => {
  describe("session math (preostalo = total - used - reserved)", () => {
    it("computes remaining sessions correctly", () => {
      const purchase = buildPackagePurchase({
        items: [{ service: id(), servicePackageId: id(), sessionsTotal: 10, sessionsUsed: 3, sessionsReserved: 2 }],
      });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.stavke[0].preostalo, 5);
    });

    it("treats a missing sessionsReserved as 0, not NaN", () => {
      const purchase = buildPackagePurchase({
        items: [{ service: id(), servicePackageId: id(), sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: undefined }],
      });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.stavke[0].preostalo, 4);
    });
  });

  describe("service/variant name resolution", () => {
    it("uses the populated service and matching package variant names when available", () => {
      const variantId = id();
      const purchase = buildPackagePurchase({
        items: [
          {
            service: { name: "Klasicna masaza", packages: [{ _id: variantId, name: "60 minuta" }] },
            servicePackageId: variantId,
            sessionsTotal: 3,
            sessionsUsed: 0,
            sessionsReserved: 0,
          },
        ],
      });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.stavke[0].usluga, "Klasicna masaza");
      assert.equal(mapped.stavke[0].varijanta, "60 minuta");
    });

    it("falls back to the raw id string when the service isn't populated", () => {
      const serviceId = id();
      const purchase = buildPackagePurchase({
        items: [{ service: serviceId, servicePackageId: id(), sessionsTotal: 1, sessionsUsed: 0, sessionsReserved: 0 }],
      });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.stavke[0].usluga, serviceId.toString());
    });
  });

  describe("status translation", () => {
    it("translates every known status", () => {
      assert.equal(mapPackagePurchaseForAdminDetail(buildPackagePurchase({ status: "active" })).status, "Aktivan");
      assert.equal(mapPackagePurchaseForAdminDetail(buildPackagePurchase({ status: "completed" })).status, "Iskorišćen");
      assert.equal(mapPackagePurchaseForAdminDetail(buildPackagePurchase({ status: "expired" })).status, "Istekao");
      assert.equal(mapPackagePurchaseForAdminDetail(buildPackagePurchase({ status: "cancelled" })).status, "Otkazan");
    });
  });

  describe("expiration display", () => {
    it("shows 'Ne ističe' for a purchase with no expiration", () => {
      const mapped = mapPackagePurchaseForAdminDetail(buildPackagePurchase({ expiresAt: null }));
      assert.equal(mapped.vreme.istice, "Ne ističe");
      assert.equal(mapped.expiresAtRaw, "");
    });

    it("formats a real expiration date on both the list and detail shapes", () => {
      const purchase = buildPackagePurchase({ expiresAt: new Date("2026-12-31") });
      const detail = mapPackagePurchaseForAdminDetail(purchase);
      assert.notEqual(detail.vreme.istice, "Ne ističe");
      assert.equal(detail.expiresAtRaw, "2026-12-31");
    });
  });

  describe("customer name resolution", () => {
    it("builds the full name from a populated user", () => {
      const purchase = buildPackagePurchase({ user: buildUser({ firstName: "Ana", lastName: "Anic" }) });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.korisnik, "Ana Anic");
    });

    it("falls back to the raw id when user isn't populated", () => {
      const userId = id();
      const purchase = buildPackagePurchase({ user: userId });
      const mapped = mapPackagePurchaseForAdminDetail(purchase);
      assert.equal(mapped.korisnik, userId.toString());
    });
  });

  describe("mapPackagePurchasesForAdminList", () => {
    it("filters out null entries", () => {
      const result = mapPackagePurchasesForAdminList([buildPackagePurchase(), null]);
      assert.equal(result.length, 1);
    });
  });

  it("returns null for a null purchase", () => {
    assert.equal(mapPackagePurchaseForAdminDetail(null), null);
  });
});
import { mapPackagePurchaseForUser, mapPackagePurchasesForUser, mapPackagePurchaseForUserDetail, effectiveStatus } from "../../../src/mappers/package-purchase.mapper.js";

describe("package-purchase.mapper - customer view", () => {
  const day = 86400000;
  const mk = (over = {}) => buildPackagePurchase({
    status: "active", expiresAt: null, pricePaid: 8000, originalPrice: 10000, discountApplied: 2000,
    items: [
      { service: id(), servicePackageId: id(), sessionsTotal: 6, sessionsUsed: 2, sessionsReserved: 1 },
      { service: id(), servicePackageId: id(), sessionsTotal: 4, sessionsUsed: 0, sessionsReserved: 0 },
    ],
    ...over,
  });

  it("sums sessions and progress across items", () => {
    const m = mapPackagePurchaseForUser(mk());
    assert.equal(m.ukupno, 10);
    assert.equal(m.iskorisceno, 2);
    assert.equal(m.rezervisano, 1);
    assert.equal(m.preostalo, 7);
    assert.equal(m.procenat, 30);
    assert.equal(m.isActive, true);
    assert.ok(m.popust);
  });

  it("active package past its expiry date is shown as expired with the lost sessions", () => {
    const p = mk({ expiresAt: new Date(Date.now() - day) });
    assert.equal(effectiveStatus(p), "expired");
    const m = mapPackagePurchaseForUser(p);
    assert.equal(m.status, "Istekao");
    assert.equal(m.isActive, false);
    assert.equal(m.propaloSeansi, 7);
  });

  it("flags a package that expires within 14 days and still has sessions", () => {
    assert.equal(mapPackagePurchaseForUser(mk({ expiresAt: new Date(Date.now() + 5 * day) })).istekaUskoro, true);
    assert.equal(mapPackagePurchaseForUser(mk({ expiresAt: new Date(Date.now() + 60 * day) })).istekaUskoro, false);
    assert.equal(mapPackagePurchaseForUser(mk()).istekaUskoro, false);
  });

  it("no expiry date means never expires", () => {
    assert.equal(mapPackagePurchaseForUser(mk()).istice, "Ne ističe");
  });

  it("does not expose notes or who recorded it", () => {
    const m = mapPackagePurchaseForUser(mk({ notes: "interno" }));
    assert.equal(JSON.stringify(m).includes("interno"), false);
    assert.equal("napomena" in m, false);
  });

  it("admin list also shows an elapsed package as expired", () => {
    const [m] = mapPackagePurchasesForAdminList([mk({ expiresAt: new Date(Date.now() - day) })]);
    assert.equal(m.status, "Istekao");
  });

  it("detail lists the appointments booked from the package", () => {
    const m = mapPackagePurchaseForUserDetail(mk(), [{ _id: id(), startTime: new Date(), status: "confirmed", service: { name: "ESMA" }, packagePurchase: id(), finalPrice: 0 }]);
    assert.equal(m.termini.length, 1);
    assert.equal(m.termini[0].placenoPaketom, true);
  });

  it("list mapper skips empty entries", () => {
    assert.equal(mapPackagePurchasesForUser([null, mk()]).length, 1);
  });
});
