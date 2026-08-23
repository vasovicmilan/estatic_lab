import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";

describe("admin site settings - hero image (HTTP)", () => {
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

  it("renders the edit form for an admin, creating the singleton settings document on first access", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const res = await agent.get("/admin/sajt");

    assert.equal(res.status, 200);
    assert.match(res.text, /heroImage/);
  });

  it("blocks a non-admin (no manage_site_content permission) with a 403", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "kupac@example.com", roleName: "user" });

    const res = await agent.get("/admin/sajt");

    assert.equal(res.status, 403);
  });

  it("uploads a hero image and alt text, and persists both", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/sajt");

    const res = await agent
      .put("/admin/sajt")
      .field("CSRFToken", token)
      .field("heroImageAlt", "Opustajuci ambijent salona")
      .attach("heroImage", TINY_PNG, "hero.png");

    assert.equal(res.status, 302);

    const settings = await siteSettingsRepo.findOrCreateSiteSettings();
    assert.ok(settings.hero.image, "a hero image path should have been stored");
    assert.equal(settings.hero.imageAlt, "Opustajuci ambijent salona");

    uploadedImageUrls.push(settings.hero.image);
  });

  it("keeps the existing image when the form is resubmitted without a new file", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: firstToken } = await getCsrfToken(agent, "/admin/sajt");
    await agent.put("/admin/sajt").field("CSRFToken", firstToken).field("heroImageAlt", "Prvobitni opis").attach("heroImage", TINY_PNG, "hero.png");

    const afterFirstUpload = await siteSettingsRepo.findOrCreateSiteSettings();
    uploadedImageUrls.push(afterFirstUpload.hero.image);

    const { token: secondToken } = await getCsrfToken(agent, "/admin/sajt");
    const res = await agent.put("/admin/sajt").field("CSRFToken", secondToken).field("heroImageAlt", "Izmenjen opis bez nove slike");

    assert.equal(res.status, 302);

    const afterSecondSubmit = await siteSettingsRepo.findOrCreateSiteSettings();
    assert.equal(afterSecondSubmit.hero.image, afterFirstUpload.hero.image, "the image path should be unchanged");
    assert.equal(afterSecondSubmit.hero.imageAlt, "Izmenjen opis bez nove slike");
  });

  it("rejects the update without a valid CSRF token, even as multipart", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await getCsrfToken(agent, "/admin/sajt");

    const res = await agent.put("/admin/sajt").field("heroImageAlt", "Bez tokena").attach("heroImage", TINY_PNG, "hero.png");

    assert.equal(res.status, 403);
  });
});