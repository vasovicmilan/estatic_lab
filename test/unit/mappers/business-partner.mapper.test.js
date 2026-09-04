import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapBusinessPartnersForAdminList,
  mapBusinessPartnerForAdminDetail,
  mapBusinessPartnerForEdit,
  mapBusinessPartnersForPublicList,
  mapBusinessPartnerForPublicDetail,
} from "../../../src/mappers/business-partner.mapper.js";
import { buildBusinessPartner } from "../../helpers/factories.js";

describe("business-partner.mapper", () => {
  describe("map visibility (imaMapu/geo)", () => {
    it("has no map when geo is entirely unset", () => {
      const partner = buildBusinessPartner({ geo: { latitude: null, longitude: null } });
      assert.equal(mapBusinessPartnerForAdminDetail(partner).imaMapu, false);
      assert.equal(mapBusinessPartnerForAdminDetail(partner).geo, null);
      assert.equal(mapBusinessPartnerForPublicDetail(partner).imaMapu, false);
    });

    it("REGRESSION: has no map when only one of latitude/longitude is set - a partial pair would produce a broken/wrong map, not a missing one", () => {
      const onlyLat = buildBusinessPartner({ geo: { latitude: 45.25, longitude: null } });
      const onlyLng = buildBusinessPartner({ geo: { latitude: null, longitude: 19.83 } });
      assert.equal(mapBusinessPartnerForAdminDetail(onlyLat).imaMapu, false);
      assert.equal(mapBusinessPartnerForAdminDetail(onlyLng).imaMapu, false);
    });

    it("has a map when both latitude and longitude are set", () => {
      const partner = buildBusinessPartner({ geo: { latitude: 45.25, longitude: 19.83 } });
      const mapped = mapBusinessPartnerForAdminDetail(partner);
      assert.equal(mapped.imaMapu, true);
      assert.deepEqual(mapped.geo, { latitude: 45.25, longitude: 19.83 });
    });
  });

  describe("mapBusinessPartnerForEdit", () => {
    it("flattens geo back out into separate latitude/longitude form fields", () => {
      const partner = buildBusinessPartner({ geo: { latitude: 45.25, longitude: 19.83 } });
      const mapped = mapBusinessPartnerForEdit(partner);
      assert.equal(mapped.latitude, 45.25);
      assert.equal(mapped.longitude, 19.83);
    });

    it("gives empty-string latitude/longitude (not null) when unset, so the number input renders blank rather than '0' or 'null'", () => {
      const partner = buildBusinessPartner({ geo: { latitude: null, longitude: null } });
      const mapped = mapBusinessPartnerForEdit(partner);
      assert.equal(mapped.latitude, "");
      assert.equal(mapped.longitude, "");
    });

    it("passes coverImage through raw ({img, imgDesc}), not reshaped to {url, alt}", () => {
      const partner = buildBusinessPartner({ coverImage: { img: "/images/partners/x.webp", imgDesc: "X" } });
      const mapped = mapBusinessPartnerForEdit(partner);
      assert.equal(mapped.coverImage.img, "/images/partners/x.webp");
    });
  });

  describe("public list/detail", () => {
    it("mapBusinessPartnersForPublicList only includes card-relevant fields", () => {
      const partner = buildBusinessPartner({ name: "Uniforme d.o.o." });
      const [card] = mapBusinessPartnersForPublicList([partner]);
      assert.equal(card.naziv, "Uniforme d.o.o.");
      assert.equal(card.slug, partner.slug);
      assert.ok(card.slika);
    });

    it("mapBusinessPartnerForPublicDetail exposes outboundUrl/ctaLabel for the CTA button", () => {
      const partner = buildBusinessPartner({ outboundUrl: "https://x.example/?ref=y", ctaLabel: "Kupite ovde" });
      const mapped = mapBusinessPartnerForPublicDetail(partner);
      assert.equal(mapped.outboundUrl, "https://x.example/?ref=y");
      assert.equal(mapped.ctaLabel, "Kupite ovde");
    });
  });

  describe("mapBusinessPartnersForAdminList", () => {
    it("drops null entries defensively", () => {
      const partner = buildBusinessPartner();
      assert.equal(mapBusinessPartnersForAdminList([partner, null]).length, 1);
    });
  });
});
