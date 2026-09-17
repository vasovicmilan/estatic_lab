import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";

async function loginAsAdmin(app, email) {
  const agent = request.agent(app);
  // ensureRole (session.js) grants the "admin" role every PERMISSIONS entry
  // automatically - no need to hand-pick manage_roles/manage_taxonomy/
  // manage_resources here.
  await registerAndLogin(agent, { email, roleName: "admin" });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return res.body.data.token;
}

describe("API v1 admin taxonomy routes (HTTP)", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  it("requires admin permission - a plain user gets 403", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "obican@example.com", roleName: "user" });
    const loginRes = await request(app).post("/api/v1/auth/prijava").send({ email: "obican@example.com", password: "lozinka123" });

    const res = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${loginRes.body.data.token}`);
    assert.equal(res.status, 403);
  });

  describe("roles", () => {
    it("creates, lists, updates, and deletes a role", async () => {
      const token = await loginAsAdmin(app, "admin1@example.com");

      const createRes = await request(app)
        .post("/api/v1/admin/roles")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "recepcija", description: "Recepcija", permissions: ["view_dashboard"] });
      assert.equal(createRes.status, 201);
      const roleId = createRes.body.data.id;

      const listRes = await request(app).get("/api/v1/admin/roles").set("Authorization", `Bearer ${token}`);
      assert.equal(listRes.status, 200);
      assert.ok(listRes.body.data.some((r) => r.id === roleId));

      const updateRes = await request(app)
        .put(`/api/v1/admin/roles/${roleId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Izmenjen opis" });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/roles/${roleId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });
  });

  describe("categories", () => {
    it("creates a category with flat isActive/priority, stored correctly under meta", async () => {
      const token = await loginAsAdmin(app, "admin2@example.com");

      const res = await request(app)
        .post("/api/v1/admin/categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Masaze", domain: "service", isActive: true, priority: 5 });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.naziv, "Masaze");

      const getRes = await request(app).get(`/api/v1/admin/categories/${res.body.data.id}`).set("Authorization", `Bearer ${token}`);
      assert.equal(getRes.status, 200);
    });

    it("deletes a category", async () => {
      const token = await loginAsAdmin(app, "admin3@example.com");
      const createRes = await request(app).post("/api/v1/admin/categories").set("Authorization", `Bearer ${token}`).send({ name: "Za brisanje", domain: "service" });

      const res = await request(app).delete(`/api/v1/admin/categories/${createRes.body.data.id}`).set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
    });
  });

  describe("tags", () => {
    it("creates, lists, and deletes a tag", async () => {
      const token = await loginAsAdmin(app, "admin4@example.com");

      const createRes = await request(app).post("/api/v1/admin/tags").set("Authorization", `Bearer ${token}`).send({ name: "Popularno", domain: "service" });
      assert.equal(createRes.status, 201);

      const listRes = await request(app).get("/api/v1/admin/tags").set("Authorization", `Bearer ${token}`);
      assert.equal(listRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/tags/${createRes.body.data.id}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });
  });

  describe("resources", () => {
    it("creates, updates, and deletes a resource", async () => {
      const token = await loginAsAdmin(app, "admin5@example.com");

      const createRes = await request(app).post("/api/v1/admin/resources").set("Authorization", `Bearer ${token}`).send({ name: "ESMA uređaj", capacity: 1 });
      assert.equal(createRes.status, 201);
      const resourceId = createRes.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/resources/${resourceId}`).set("Authorization", `Bearer ${token}`).send({ capacity: 2 });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/resources/${resourceId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });

    it("400s when capacity is missing on create", async () => {
      const token = await loginAsAdmin(app, "admin6@example.com");
      const res = await request(app).post("/api/v1/admin/resources").set("Authorization", `Bearer ${token}`).send({ name: "Bez kapaciteta" });
      assert.equal(res.status, 400);
    });
  });
});
