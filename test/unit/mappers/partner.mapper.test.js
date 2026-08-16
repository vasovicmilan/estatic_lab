import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapPartnerForAdminShort,
  mapPartnersForAdminList,
  mapPartnerForAdminDetail,
  mapPartnerForEdit,
  mapPartnerForPartnerDetail,
  mapPartnerRaw,
  mapPartner,
} from "../../../src/mappers/partner.mapper.js";
import { buildUser, id } from "../../helpers/factories.js";

function buildPartner(overrides = {}) {
  return {
    _id: id(),
    userId: buildUser(),
    commissionRateServices: 10,
    commissionRateProducts: 5,
    maxCommissionAmountServices: null,
    maxCommissionAmountProducts: null,
    isActive: true,
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("partner.mapper", () => {
  describe("getFullName/getEmail/getPhone - populated vs unpopulated userId", () => {
    it("resolves name/email/phone from a populated userId", () => {
      const partner = buildPartner({ userId: buildUser({ firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", phone: "0641234567" }) });
      const mapped = mapPartnerForAdminDetail(partner);
      assert.equal(mapped.korisnik.imePrezime, "Petar Petrovic");
      assert.equal(mapped.korisnik.email, "petar@example.com");
      assert.equal(mapped.korisnik.telefon, "0641234567");
    });

    it("falls back to 'Nepoznato'/null/null when userId is a raw (unpopulated) id", () => {
      const partner = buildPartner({ userId: id() });
      const mapped = mapPartnerForAdminDetail(partner);
      assert.equal(mapped.korisnik.imePrezime, "Nepoznato");
      assert.equal(mapped.korisnik.email, null);
      assert.equal(mapped.korisnik.telefon, null);
    });
  });

  describe("mapPartnerForAdminShort / mapPartnersForAdminList", () => {
    it("translates isActive to Da/Ne and formats both commission rates with a % suffix", () => {
      const partner = buildPartner({ isActive: false, commissionRateServices: 15, commissionRateProducts: 3 });
      const mapped = mapPartnerForAdminShort(partner);
      assert.equal(mapped.aktivan, "Ne");
      assert.equal(mapped.procenatProvizijeUsluge, "15%");
      assert.equal(mapped.procenatProvizijeArtikli, "3%");
    });

    it("mapPartnersForAdminList maps a whole array", () => {
      const list = mapPartnersForAdminList([buildPartner(), buildPartner()]);
      assert.equal(list.length, 2);
    });
  });

  describe("mapPartnerForAdminDetail", () => {
    it("returns null for a null partner", () => {
      assert.equal(mapPartnerForAdminDetail(null), null);
    });

    it("includes both the formatted and raw commission rate for services AND products, independently", () => {
      const partner = buildPartner({ commissionRateServices: 12, commissionRateProducts: 4 });
      const mapped = mapPartnerForAdminDetail(partner);
      assert.equal(mapped.procenatProvizijeUsluge, "12%");
      assert.equal(mapped.procenatProvizijeUslugeRaw, 12);
      assert.equal(mapped.procenatProvizijeArtikli, "4%");
      assert.equal(mapped.procenatProvizijeArtikliRaw, 4);
    });

    it("shows 'Bez ograničenja' when a max commission amount is null, the formatted amount otherwise", () => {
      const unlimited = mapPartnerForAdminDetail(buildPartner({ maxCommissionAmountServices: null, maxCommissionAmountProducts: null }));
      assert.equal(unlimited.maxProvizijaUsluge, "Bez ograničenja");
      assert.equal(unlimited.maxProvizijaArtikli, "Bez ograničenja");

      const capped = mapPartnerForAdminDetail(buildPartner({ maxCommissionAmountServices: 5000, maxCommissionAmountProducts: 50000 }));
      assert.equal(capped.maxProvizijaUsluge, "5000 RSD");
      assert.equal(capped.maxProvizijaArtikli, "50000 RSD");
    });

    it("defaults notes to null when empty", () => {
      const mapped = mapPartnerForAdminDetail(buildPartner({ notes: "" }));
      assert.equal(mapped.napomena, null);
    });
  });

  describe("mapPartnerForEdit - raw shape for the admin form", () => {
    it("returns null for a null partner", () => {
      assert.equal(mapPartnerForEdit(null), null);
    });

    it("flattens a populated userId to a plain id string", () => {
      const userId = id();
      const partner = buildPartner({ userId: { _id: userId, firstName: "Petar", lastName: "Petrovic" } });
      assert.equal(mapPartnerForEdit(partner).userId, userId.toString());
    });

    it("flattens a raw (unpopulated) userId the same way", () => {
      const userId = id();
      const partner = buildPartner({ userId });
      assert.equal(mapPartnerForEdit(partner).userId, userId.toString());
    });
  });

  describe("mapPartnerForPartnerDetail - the partner's own dashboard, no admin-only fields", () => {
    it("exposes only id/name/both commission rates", () => {
      const partner = buildPartner();
      const mapped = mapPartnerForPartnerDetail(partner);
      assert.deepEqual(Object.keys(mapped).sort(), ["id", "imePrezime", "procenatProvizijeArtikli", "procenatProvizijeUsluge"]);
    });
  });

  describe("mapPartnerRaw", () => {
    it("returns the object unchanged", () => {
      const partner = buildPartner();
      assert.equal(mapPartnerRaw(partner), partner);
    });
  });

  describe("mapPartner dispatcher", () => {
    it("returns null for a null partner regardless of role", () => {
      assert.equal(mapPartner(null, "admin", "detail"), null);
    });

    it("routes admin+short to mapPartnerForAdminShort", () => {
      const mapped = mapPartner(buildPartner(), "admin", "short");
      assert.ok("aktivan" in mapped && !("korisnik" in mapped));
    });

    it("routes admin+detail to mapPartnerForAdminDetail", () => {
      const mapped = mapPartner(buildPartner(), "admin", "detail");
      assert.ok("korisnik" in mapped);
    });

    it("routes any non-admin role to mapPartnerForPartnerDetail", () => {
      const mapped = mapPartner(buildPartner(), "partner", "detail");
      assert.deepEqual(Object.keys(mapped).sort(), ["id", "imePrezime", "procenatProvizijeArtikli", "procenatProvizijeUsluge"]);
    });
  });
});