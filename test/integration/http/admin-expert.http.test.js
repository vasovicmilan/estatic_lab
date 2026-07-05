import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import expertRepo from "../../../src/repositories/expert.repository.js";

describe("admin expert CRUD + image upload (HTTP)", () => {
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

  it("creates an expert with an uploaded image and description", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");

    const res = await agent
      .post("/admin/eksperti")
      .field("CSRFToken", token)
      .field("firstName", "Ana")
      .field("lastName", "Anic")
      .field("imageDesc", "Fotografija terapeuta Ane Anic")
      .attach("expertImage", TINY_PNG, "test.png");

    assert.equal(res.status, 302);

    const result = await expertRepo.findExperts({});
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].firstName, "Ana");
    assert.ok(result.data[0].slug);
    assert.equal(result.data[0].image?.imgDesc, "Fotografija terapeuta Ane Anic");

    uploadedImageUrls.push(result.data[0].image.img);
  });

  it("rejects an expert without an image", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");

    const res = await agent.post("/admin/eksperti").field("CSRFToken", token).field("firstName", "Ana").field("lastName", "Anic");

    assert.equal(res.status, 400);
    const result = await expertRepo.findExperts({});
    assert.equal(result.data.length, 0);
  });

  it("rejects an uploaded image with no description, as a clean 400 rather than a 500", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");

    const res = await agent
      .post("/admin/eksperti")
      .field("CSRFToken", token)
      .field("firstName", "Ana")
      .field("lastName", "Anic")
      .attach("expertImage", TINY_PNG, "test.png");

    assert.equal(res.status, 400);
    const result = await expertRepo.findExperts({});
    assert.equal(result.data.length, 0);
  });

  it("edits an existing expert", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");
    await agent
      .post("/admin/eksperti")
      .field("CSRFToken", createToken)
      .field("firstName", "Ana")
      .field("lastName", "Anic")
      .field("imageDesc", "Fotografija terapeuta Ane Anic")
      .attach("expertImage", TINY_PNG, "test.png");

    const existing = (await expertRepo.findExperts({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: editToken } = await getCsrfToken(agent, `/admin/eksperti/izmena/${existing._id}`);
    const res = await agent
      .put(`/admin/eksperti/${existing._id}`)
      .field("CSRFToken", editToken)
      .field("firstName", "Izmenjeno")
      .field("lastName", "Anic");

    assert.equal(res.status, 302);
    const updated = await expertRepo.findExpertById(existing._id);
    assert.equal(updated.firstName, "Izmenjeno");
  });

  it("deletes an expert", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");
    await agent
      .post("/admin/eksperti")
      .field("CSRFToken", createToken)
      .field("firstName", "Za")
      .field("lastName", "Brisanje")
      .field("imageDesc", "Fotografija za brisanje")
      .attach("expertImage", TINY_PNG, "test.png");

    const existing = (await expertRepo.findExperts({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");
    const res = await agent.delete(`/admin/eksperti/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await expertRepo.findExpertById(existing._id);
    assert.equal(found, null);
  });
});