import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareBusinessPartnerFormData,
  prepareBusinessPartnerDetailsData,
  prepareBusinessPartnerListData,
} from "../../../../../src/presenters/admin/marketing/business-partner.presenter.js";

describe("business-partner.presenter", () => {
  describe("prepareBusinessPartnerFormData - formAction", () => {
    it("REGRESSION: posts to the router root (/admin/saradnici) when creating - NOT the GET-only /dodavanje form page, which has no POST handler and would 404 (see campaign.presenter.js's identical earlier bug)", () => {
      const view = prepareBusinessPartnerFormData(null);
      assert.equal(view.isEdit, false);
      assert.equal(view.formAction, "/admin/saradnici");
    });

    it("REGRESSION: PUTs to /admin/saradnici/:id when editing - NOT the GET-only /izmena/:id form page, which has no PUT handler", () => {
      const view = prepareBusinessPartnerFormData({ id: "p1", name: "X", shortDescription: "Y" });
      assert.equal(view.isEdit, true);
      assert.equal(view.formAction, "/admin/saradnici/p1");
    });
  });

  describe("prepareBusinessPartnerFormData - fields", () => {
    it("only shows the slug field on edit, not on create", () => {
      const createView = prepareBusinessPartnerFormData(null);
      const editView = prepareBusinessPartnerFormData({ id: "p1", name: "X", shortDescription: "Y" });
      assert.ok(!createView.fields.some((f) => f.name === "slug"));
      assert.ok(editView.fields.some((f) => f.name === "slug"));
    });

    it("only requires a new cover image upload on create, not on edit (an existing image may already be set)", () => {
      const createView = prepareBusinessPartnerFormData(null);
      const editView = prepareBusinessPartnerFormData({ id: "p1", name: "X", shortDescription: "Y" });
      assert.equal(createView.fields.find((f) => f.name === "coverImage").required, true);
      assert.equal(editView.fields.find((f) => f.name === "coverImage").required, false);
    });

    it("previews the existing cover image's raw .img path on edit (matches mapBusinessPartnerForEdit's raw shape, not {url,alt})", () => {
      const editView = prepareBusinessPartnerFormData({ id: "p1", name: "X", shortDescription: "Y", coverImage: { img: "/images/partners/x.webp", imgDesc: "X" } });
      assert.equal(editView.fields.find((f) => f.name === "coverImage").preview, "/images/partners/x.webp");
    });

    it("defaults ctaLabel to 'Poseti prodavnicu' on create", () => {
      const view = prepareBusinessPartnerFormData(null);
      assert.equal(view.fields.find((f) => f.name === "ctaLabel").value, "Poseti prodavnicu");
    });
  });

  describe("prepareBusinessPartnerDetailsData", () => {
    it("includes a map section only when imaMapu is true", () => {
      const withMap = prepareBusinessPartnerDetailsData({
        id: "p1", naziv: "X", slug: "x", kratakOpis: "Y", aktivan: true, adresa: null,
        outboundUrl: "https://x.com", ctaLabel: "Idi", slika: null, imaMapu: true,
        geo: { latitude: 45.25, longitude: 19.83 }, sadrzaj: [], vreme: { kreiran: "-", azuriran: "-" },
      });
      const withoutMap = prepareBusinessPartnerDetailsData({
        id: "p1", naziv: "X", slug: "x", kratakOpis: "Y", aktivan: true, adresa: null,
        outboundUrl: "https://x.com", ctaLabel: "Idi", slika: null, imaMapu: false,
        geo: null, sadrzaj: [], vreme: { kreiran: "-", azuriran: "-" },
      });

      assert.ok(withMap.sections.some((s) => s.title === "Lokacija"));
      assert.ok(!withoutMap.sections.some((s) => s.title === "Lokacija"));
    });
  });

  describe("prepareBusinessPartnerListData", () => {
    it("carries pagination/search query through", () => {
      const view = prepareBusinessPartnerListData({ data: [], page: 1, totalPages: 1 }, { search: "uniforme" });
      assert.equal(view.topbar.search, "uniforme");
    });
  });
});
