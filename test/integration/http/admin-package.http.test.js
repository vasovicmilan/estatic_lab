import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import packageRepo from "../../../src/repositories/package.repository.js";

describe("admin package CRUD + image upload (HTTP)", () => {
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

  it("creates a package with an uploaded image and a JSON-encoded items array", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/paketi/dodavanje");

    const res = await agent
      .post("/admin/paketi")
      .field("CSRFToken", token)
      .field("name", "Dan Za Sebe")
      .field("description", "Kombinovani paket usluga")
      .field("totalPrice", "8000")
      .field("items", JSON.stringify([{ service: new mongoose.Types.ObjectId().toString(), sessions: 1 }]))
      .attach("packageImage", TINY_PNG, "test.png");

    assert.equal(res.status, 302);

    const result = await packageRepo.findPackages({});
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "Dan Za Sebe");
    assert.ok(result.data[0].slug);
    assert.ok(result.data[0].image?.img);

    uploadedImageUrls.push(result.data[0].image.img);
  });

  it("rejects a package with no items", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/paketi/dodavanje");

    const res = await agent
      .post("/admin/paketi")
      .field("CSRFToken", token)
      .field("name", "Bez Stavki")
      .field("description", "Opis")
      .field("totalPrice", "1000")
      .field("items", JSON.stringify([]));

    assert.equal(res.status, 400);
    const result = await packageRepo.findPackages({});
    assert.equal(result.data.length, 0);
  });

  it("edits an existing package", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/paketi/dodavanje");
    await agent
      .post("/admin/paketi")
      .field("CSRFToken", createToken)
      .field("name", "Original")
      .field("description", "Opis")
      .field("totalPrice", "8000")
      .field("items", JSON.stringify([{ service: new mongoose.Types.ObjectId().toString(), sessions: 1 }]))
      .attach("packageImage", TINY_PNG, "test.png");

    const existing = (await packageRepo.findPackages({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: editToken } = await getCsrfToken(agent, `/admin/paketi/izmena/${existing._id}`);
    const res = await agent
      .put(`/admin/paketi/${existing._id}`)
      .field("CSRFToken", editToken)
      .field("name", "Izmenjeno")
      .field("description", "Opis")
      .field("totalPrice", "9000")
      .field("items", JSON.stringify([{ service: new mongoose.Types.ObjectId().toString(), sessions: 2 }]));

    assert.equal(res.status, 302);
    const updated = await packageRepo.findPackageById(existing._id);
    assert.equal(updated.name, "Izmenjeno");
    assert.equal(updated.totalPrice, 9000);
  });

  it("deletes a package", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/paketi/dodavanje");
    await agent
      .post("/admin/paketi")
      .field("CSRFToken", createToken)
      .field("name", "Za Brisanje")
      .field("description", "Opis")
      .field("totalPrice", "1000")
      .field("items", JSON.stringify([{ service: new mongoose.Types.ObjectId().toString(), sessions: 1 }]))
      .attach("packageImage", TINY_PNG, "test.png");

    const existing = (await packageRepo.findPackages({})).data[0];
    uploadedImageUrls.push(existing.image.img);

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/paketi/dodavanje");
    const res = await agent.delete(`/admin/paketi/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await packageRepo.findPackageById(existing._id);
    assert.equal(found, null);
  });
});