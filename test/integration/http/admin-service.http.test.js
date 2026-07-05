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

  it("creates a service with an uploaded image and a JSON-encoded packages array", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/usluge/dodavanje");

    const res = await agent
      .post("/admin/usluge")
      .field("CSRFToken", token)
      .field("name", "Sportska Masaza")
      .field("packages", JSON.stringify([{ name: "60 minuta", duration: 60, totalPrice: 3000 }]))
      .field("imageDesc", "Sportska masaza")
      .attach("serviceImage", TINY_PNG, "test.png");

    assert.equal(res.status, 302);

    const result = await serviceRepo.findServices({});
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "Sportska Masaza");
    assert.equal(result.data[0].packages.length, 1);
    assert.ok(result.data[0].packages[0].slug, "the variant slug should have been auto-generated");
    assert.ok(result.data[0].image?.img);

    uploadedImageUrls.push(result.data[0].image.img);
  });

  it("rejects a service with zero variants", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/usluge/dodavanje");

    const res = await agent
      .post("/admin/usluge")
      .field("CSRFToken", token)
      .field("name", "Bez Varijanti")
      .field("packages", JSON.stringify([]))
      .field("imageDesc", "Bez varijanti")
      .attach("serviceImage", TINY_PNG, "test.png");

    assert.equal(res.status, 400);
    const result = await serviceRepo.findServices({});
    assert.equal(result.data.length, 0);
  });

  it("edits an existing service", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/usluge/dodavanje");
    await agent
      .post("/admin/usluge")
      .field("CSRFToken", createToken)
      .field("name", "Originalna Usluga")
      .field("packages", JSON.stringify([{ name: "60 minuta", duration: 60, totalPrice: 3000 }]))
      .field("imageDesc", "Originalna usluga")
      .attach("serviceImage", TINY_PNG, "test.png");

    const existing = (await serviceRepo.findServices({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: editToken } = await getCsrfToken(agent, `/admin/usluge/izmena/${existing._id}`);
    const res = await agent
      .put(`/admin/usluge/${existing._id}`)
      .field("CSRFToken", editToken)
      .field("name", "Izmenjena Usluga")
      .field("packages", JSON.stringify([{ name: "90 minuta", duration: 90, totalPrice: 4000 }]));

    assert.equal(res.status, 302);
    const updated = await serviceRepo.findServiceById(existing._id);
    assert.equal(updated.name, "Izmenjena Usluga");
    assert.equal(updated.packages[0].duration, 90);
  });

  it("deletes a service", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/usluge/dodavanje");
    await agent
      .post("/admin/usluge")
      .field("CSRFToken", createToken)
      .field("name", "Za Brisanje")
      .field("packages", JSON.stringify([{ name: "60 minuta", duration: 60, totalPrice: 3000 }]))
      .field("imageDesc", "Slika za brisanje")
      .attach("serviceImage", TINY_PNG, "test.png");

    const existing = (await serviceRepo.findServices({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/usluge/dodavanje");
    const res = await agent.delete(`/admin/usluge/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await serviceRepo.findServiceById(existing._id);
    assert.equal(found, null);
  });
});