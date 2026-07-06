import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import serviceRepo from "../../../src/repositories/service.repository.js";

describe("admin service CRUD + image upload (HTTP)", () => {
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

  // walks all 3 phases and returns the resulting serviceId, for tests that need a
  // fully-published fixture rather than testing the wizard itself
  async function createServiceThroughWizard(agent, { name = "Sportska Masaza" } = {}) {
    const { token: step1Token } = await getCsrfToken(agent, "/admin/usluge/dodavanje");
    const step1Res = await agent
      .post("/admin/usluge/dodavanje")
      .field("CSRFToken", step1Token)
      .field("name", name)
      .field("imageDesc", name)
      .attach("serviceImage", TINY_PNG, "test.png");
    assert.equal(step1Res.status, 302);

    const serviceId = (await serviceRepo.findServices({})).data[0]._id.toString();
    uploadedImageUrls.push((await serviceRepo.findServiceById(serviceId)).image.img);

    const { token: step2Token } = await getCsrfToken(agent, `/admin/usluge/${serviceId}/dodavanje/paketi`);
    const step2Res = await agent
      .post(`/admin/usluge/${serviceId}/dodavanje/paketi`)
      .type("form")
      .send({ CSRFToken: step2Token, packages: JSON.stringify([{ name: "60 minuta", duration: 60, totalPrice: 3000 }]) });
    assert.equal(step2Res.status, 302);

    const { token: step3Token } = await getCsrfToken(agent, `/admin/usluge/${serviceId}/dodavanje/detalji`);
    const step3Res = await agent
      .post(`/admin/usluge/${serviceId}/dodavanje/detalji`)
      .type("form")
      .send({ CSRFToken: step3Token, isActive: "1" });
    assert.equal(step3Res.status, 302);

    return serviceId;
  }

  it("phase 1 creates a draft service with an uploaded image", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/usluge/dodavanje");

    const res = await agent
      .post("/admin/usluge/dodavanje")
      .field("CSRFToken", token)
      .field("name", "Sportska Masaza")
      .field("imageDesc", "Sportska masaza")
      .attach("serviceImage", TINY_PNG, "test.png");

    assert.equal(res.status, 302);
    assert.match(res.headers.location, /\/dodavanje\/paketi$/);

    const result = await serviceRepo.findServices({});
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "Sportska Masaza");
    assert.equal(result.data[0].isActive, false);
    assert.equal(result.data[0].packages.length, 0);
    assert.ok(result.data[0].image?.img);

    uploadedImageUrls.push(result.data[0].image.img);
  });

  it("phase 2 rejects zero variants", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await getCsrfToken(agent, "/admin/usluge/dodavanje");

    const step1 = await agent
      .post("/admin/usluge/dodavanje")
      .field("CSRFToken", (await getCsrfToken(agent, "/admin/usluge/dodavanje")).token)
      .field("name", "Bez Varijanti")
      .field("imageDesc", "Bez varijanti")
      .attach("serviceImage", TINY_PNG, "test.png");
    const serviceId = (await serviceRepo.findServices({})).data[0]._id.toString();
    uploadedImageUrls.push((await serviceRepo.findServiceById(serviceId)).image.img);

    const { token } = await getCsrfToken(agent, `/admin/usluge/${serviceId}/dodavanje/paketi`);
    const res = await agent
      .post(`/admin/usluge/${serviceId}/dodavanje/paketi`)
      .type("form")
      .send({ CSRFToken: token, packages: JSON.stringify([]) });

    assert.equal(res.status, 400);
    const service = await serviceRepo.findServiceById(serviceId);
    assert.equal(service.packages.length, 0);
  });

  it("phase 3 publishes the service once packages exist", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const serviceId = await createServiceThroughWizard(agent);

    const published = await serviceRepo.findServiceById(serviceId);
    assert.equal(published.isActive, true);
    assert.equal(published.packages.length, 1);
  });

  it("edits an existing (published) service", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const serviceId = await createServiceThroughWizard(agent, { name: "Originalna Usluga" });

    const { token: editToken } = await getCsrfToken(agent, `/admin/usluge/izmena/${serviceId}`);
    const res = await agent
      .put(`/admin/usluge/${serviceId}`)
      .field("CSRFToken", editToken)
      .field("name", "Izmenjena Usluga")
      .field("packages", JSON.stringify([{ name: "90 minuta", duration: 90, totalPrice: 4000 }]));

    assert.equal(res.status, 302);
    const updated = await serviceRepo.findServiceById(serviceId);
    assert.equal(updated.name, "Izmenjena Usluga");
    assert.equal(updated.packages[0].duration, 90);
  });

  it("deletes a service", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const serviceId = await createServiceThroughWizard(agent, { name: "Za Brisanje" });

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/usluge/dodavanje");
    const res = await agent.delete(`/admin/usluge/${serviceId}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await serviceRepo.findServiceById(serviceId);
    assert.equal(found, null);
  });
});