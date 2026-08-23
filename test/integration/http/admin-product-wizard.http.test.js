import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import productRepo from "../../../src/repositories/product.repository.js";

/**
 * HTTP-level coverage for the admin product creation wizard (3 phases: draft ->
 * details/media -> SEO/publish) - never exercised through the real
 * form/validator/controller/service/multer chain before this test existed
 * (product.controller.js sat at ~15% line, 0% function coverage). Phase 3 is
 * where shippingClass (today's freight/standard split) actually gets set, so this
 * is also the first HTTP-level check that the field survives the real form path,
 * not just direct model creation like the E2E specs use.
 */
describe("admin product creation wizard (HTTP)", () => {
  let app;
  let uploadedImageUrls = [];

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await Promise.all(uploadedImageUrls.map(cleanupUploadedImage));
    uploadedImageUrls = [];
    await clearTestDatabase();
  });

  async function walkToPhase2(agent) {
    const { token } = await getCsrfToken(agent, "/admin/proizvodi/dodavanje");
    const res = await agent.post("/admin/proizvodi/dodavanje").type("form").send({
      CSRFToken: token,
      name: "ESMA Uredjaj",
      sku: `ESMA-${Date.now()}`,
    });
    assert.equal(res.status, 302);
    const [, productId] = res.headers.location.match(/\/admin\/proizvodi\/([^/]+)\/dodavanje\/detalji/);
    return productId;
  }

  it("walks all three phases and publishes a 'freight' product", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const productId = await walkToPhase2(agent);

    const { token: phase2Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/detalji`);
    const phase2Res = await agent
      .post(`/admin/proizvodi/${productId}/dodavanje/detalji`)
      .field("CSRFToken", phase2Token)
      .field("variations", JSON.stringify([{ label: "Standard", price: 250000, stock: 3 }]))
      .field("shortDescription", "Veliki uredjaj za HTTP test.")
      .field("imageDesc", "ESMA uredjaj")
      .attach("productImage", TINY_PNG, "uredjaj.png");
    assert.equal(phase2Res.status, 302);

    const afterPhase2 = await productRepo.findProductDocById(productId);
    if (afterPhase2.image?.img) uploadedImageUrls.push(afterPhase2.image.img);

    const { token: phase3Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/seo`);
    const phase3Res = await agent
      .post(`/admin/proizvodi/${productId}/dodavanje/seo`)
      .type("form")
      .send({
        CSRFToken: phase3Token,
        shippingClass: "freight",
        isActive: "true",
      });

    assert.equal(phase3Res.status, 302);

    const final = await productRepo.findProductDocById(productId);
    assert.equal(final.shippingClass, "freight");
    assert.equal(final.isActive, true);
    assert.equal(final.variations.length, 1);
    assert.equal(final.variations[0].price, 250000);
  });

  it("defaults to 'standard' shipping when the field is left unset", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const productId = await walkToPhase2(agent);

    const { token: phase2Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/detalji`);
    await agent
      .post(`/admin/proizvodi/${productId}/dodavanje/detalji`)
      .field("CSRFToken", phase2Token)
      .field("variations", JSON.stringify([{ label: "Standard", price: 1500, stock: 20 }]))
      .field("imageDesc", "Sitan artikal")
      .attach("productImage", TINY_PNG, "sitanartikal.png");

    const afterPhase2 = await productRepo.findProductDocById(productId);
    if (afterPhase2.image?.img) uploadedImageUrls.push(afterPhase2.image.img);

    const { token: phase3Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/seo`);
    await agent.post(`/admin/proizvodi/${productId}/dodavanje/seo`).type("form").send({
      CSRFToken: phase3Token,
      isActive: "true",
    });

    const final = await productRepo.findProductDocById(productId);
    assert.equal(final.shippingClass, "standard");
  });

  it("refuses to publish (isActive: true) without an image, even with a variation present", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const productId = await walkToPhase2(agent);

    // phase 2 without attaching an image - imageDesc is only required-if-uploaded,
    // so this itself passes validation and saves a variation with no image
    const { token: phase2Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/detalji`);
    await agent
      .post(`/admin/proizvodi/${productId}/dodavanje/detalji`)
      .field("CSRFToken", phase2Token)
      .field("variations", JSON.stringify([{ label: "Standard", price: 1000, stock: 5 }]));

    const { token: phase3Token } = await getCsrfToken(agent, `/admin/proizvodi/${productId}/dodavanje/seo`);
    const res = await agent.post(`/admin/proizvodi/${productId}/dodavanje/seo`).type("form").send({
      CSRFToken: phase3Token,
      isActive: "true",
    });

    // validatePublishInvariants (product.model.js) rejects isActive:true without an
    // image at the model layer - the wizard's own multi-phase flow can't bypass it
    assert.equal(res.status, 400);
    const stillDraft = await productRepo.findProductDocById(productId);
    assert.equal(stillDraft.isActive, false);
  });
});