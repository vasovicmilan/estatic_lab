import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import categoryRepo from "../../../src/repositories/category.repository.js";

describe("admin category CRUD + image upload (HTTP)", () => {
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

  it("creates a category with an uploaded image", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/kategorije/dodavanje");

    const res = await agent
      .post("/admin/kategorije")
      .field("CSRFToken", token)
      .field("name", "Masaze Lica")
      .field("domain", "service")
      .attach("categoryImage", TINY_PNG, "test.png");

    assert.equal(res.status, 302);

    const result = await categoryRepo.findCategories({ filters: { domain: "service" } });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "Masaze Lica");
    assert.ok(result.data[0].featureImage?.img, "the uploaded image should be attached to the category");

    uploadedImageUrls.push(result.data[0].featureImage.img);
  });

  it("rejects category creation without a valid CSRF token, even as multipart", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await getCsrfToken(agent, "/admin/kategorije/dodavanje"); // establish session, deliberately ignore the token

    const res = await agent
      .post("/admin/kategorije")
      .field("name", "Bez Tokena")
      .field("domain", "service")
      .attach("categoryImage", TINY_PNG, "test.png");

    assert.equal(res.status, 403);
  });

  it("edits an existing category, replacing its image", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/kategorije/dodavanje");
    await agent
      .post("/admin/kategorije")
      .field("CSRFToken", createToken)
      .field("name", "Originalno Ime")
      .field("domain", "service")
      .attach("categoryImage", TINY_PNG, "test.png");

    const existing = (await categoryRepo.findCategories({ filters: { domain: "service" } })).data[0];
    uploadedImageUrls.push(existing.featureImage.img);

    const { token: editToken } = await getCsrfToken(agent, `/admin/kategorije/izmena/${existing._id}`);
    const res = await agent
      .put(`/admin/kategorije/${existing._id}`)
      .field("CSRFToken", editToken)
      .field("name", "Izmenjeno Ime")
      .field("domain", "service")
      .attach("categoryImage", TINY_PNG, "test2.png");

    assert.equal(res.status, 302);

    const updated = await categoryRepo.findCategoryById(existing._id);
    assert.equal(updated.name, "Izmenjeno Ime");
    uploadedImageUrls.push(updated.featureImage.img);
  });

  it("deletes a category", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/kategorije/dodavanje");
    await agent
      .post("/admin/kategorije")
      .field("CSRFToken", createToken)
      .field("name", "Za Brisanje")
      .field("domain", "service")
      .attach("categoryImage", TINY_PNG, "test.png");

    const existing = (await categoryRepo.findCategories({ filters: { domain: "service" } })).data[0];
    uploadedImageUrls.push(existing.featureImage.img);

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/kategorije/dodavanje");
    const res = await agent.delete(`/admin/kategorije/${existing._id}`).set("X-CSRF-Token", deleteToken);


    assert.equal(res.status, 302);
    const found = await categoryRepo.findCategoryById(existing._id);
    assert.equal(found, null);
  });
});