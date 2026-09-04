import { describe, it } from "node:test";
import assert from "node:assert/strict";
import businessPartnerRepo from "../../../src/repositories/business-partner.repository.js";
import * as businessPartnerService from "../../../src/services/business-partner.service.js";
import { buildBusinessPartner, id } from "../../helpers/factories.js";

describe("business-partner.service", () => {
  describe("createBusinessPartner", () => {
    it("rejects without a name", async () => {
      await assert.rejects(
        () => businessPartnerService.createBusinessPartner({ shortDescription: "X", coverImage: {}, outboundUrl: "https://x.com" }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects without a coverImage", async () => {
      await assert.rejects(
        () => businessPartnerService.createBusinessPartner({ name: "X", shortDescription: "Y", outboundUrl: "https://x.com" }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects without an outboundUrl", async () => {
      await assert.rejects(
        () => businessPartnerService.createBusinessPartner({ name: "X", shortDescription: "Y", coverImage: {} }),
        (err) => err.statusCode === 400
      );
    });

    it("auto-generates a unique slug from the name when none is given", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => null);
      let createPayload;
      t.mock.method(businessPartnerRepo, "createBusinessPartner", async (data) => {
        createPayload = data;
        return buildBusinessPartner(data);
      });
      t.mock.method(businessPartnerRepo, "findBusinessPartnerById", async () => buildBusinessPartner(createPayload));

      await businessPartnerService.createBusinessPartner({ name: "Uniforme d.o.o.", shortDescription: "Y", coverImage: {}, outboundUrl: "https://x.com" });

      assert.equal(createPayload.slug, "uniforme-doo");
    });

    it("rejects a manually-given slug that's already taken", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => buildBusinessPartner());
      await assert.rejects(
        () =>
          businessPartnerService.createBusinessPartner({
            name: "X",
            shortDescription: "Y",
            coverImage: {},
            outboundUrl: "https://x.com",
            slug: "uniforme-doo",
          }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("updateBusinessPartnerById", () => {
    it("throws 404 for a nonexistent partner", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerById", async () => null);
      await assert.rejects(
        () => businessPartnerService.updateBusinessPartnerById(id().toString(), { name: "X" }),
        (err) => err.statusCode === 404
      );
    });

    it("rejects renaming the slug to one already used by a different partner", async (t) => {
      const existing = buildBusinessPartner({ slug: "uniforme-doo" });
      t.mock.method(businessPartnerRepo, "findBusinessPartnerById", async () => existing);
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => buildBusinessPartner({ slug: "drugi-slug" }));

      await assert.rejects(
        () => businessPartnerService.updateBusinessPartnerById(existing._id.toString(), { slug: "drugi-slug" }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("deleteBusinessPartnerById", () => {
    it("throws 404 for a nonexistent partner", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerById", async () => null);
      await assert.rejects(() => businessPartnerService.deleteBusinessPartnerById(id().toString()), (err) => err.statusCode === 404);
    });

    it("deletes an existing partner", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerById", async () => buildBusinessPartner());
      t.mock.method(businessPartnerRepo, "deleteBusinessPartnerById", async () => {});
      const result = await businessPartnerService.deleteBusinessPartnerById(id().toString());
      assert.equal(result.success, true);
    });
  });

  describe("getPublicBusinessPartnerBySlug", () => {
    it("throws 404 for a nonexistent slug", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => null);
      await assert.rejects(() => businessPartnerService.getPublicBusinessPartnerBySlug("nepostojeci"), (err) => err.statusCode === 404);
    });

    it("throws 404 for an inactive partner - not shown publicly even at its own direct URL", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => buildBusinessPartner({ isActive: false }));
      await assert.rejects(() => businessPartnerService.getPublicBusinessPartnerBySlug("uniforme-doo"), (err) => err.statusCode === 404);
    });

    it("returns the partner with SEO attached for an active partner", async (t) => {
      t.mock.method(businessPartnerRepo, "findBusinessPartnerBySlug", async () => buildBusinessPartner({ isActive: true }));
      const result = await businessPartnerService.getPublicBusinessPartnerBySlug("uniforme-doo");
      assert.equal(result.naziv, "Uniforme d.o.o.");
      assert.ok(result.seo.pageTitle);
    });
  });

  describe("listPublicBusinessPartners", () => {
    it("only returns active partners (delegates to findActiveBusinessPartners) with SEO attached", async (t) => {
      t.mock.method(businessPartnerRepo, "findActiveBusinessPartners", async () => [buildBusinessPartner()]);
      const result = await businessPartnerService.listPublicBusinessPartners();
      assert.equal(result.data.length, 1);
      assert.ok(result.seo.pageTitle);
    });
  });

  describe("listSlugsForSitemap", () => {
    it("delegates to findActiveSlugsForSitemap (active partners only)", async (t) => {
      const mock = t.mock.method(businessPartnerRepo, "findActiveSlugsForSitemap", async () => [{ slug: "uniforme-doo" }]);
      const result = await businessPartnerService.listSlugsForSitemap();
      assert.equal(mock.mock.calls.length, 1);
      assert.deepEqual(result, [{ slug: "uniforme-doo" }]);
    });
  });
});
