import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";

async function loginAsAdmin(app, email) {
  const agent = request.agent(app);
  await registerAndLogin(agent, { email, roleName: "admin" });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return res.body.data.token;
}

async function createTargetUser(app, email) {
  const target = await registerAndLogin(request.agent(app), { email, roleName: "user" });
  return target._id.toString();
}

describe("API v1 admin people routes (HTTP)", () => {
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

  describe("users", () => {
    it("lists users, updates status/role, verifies, and deletes", async () => {
      const adminToken = await loginAsAdmin(app, "admin1@example.com");
      const targetUserId = await createTargetUser(app, "meta1@example.com");
      const employeeRole = await ensureRole("employee");

      const listRes = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${adminToken}`);
      assert.equal(listRes.status, 200);
      assert.ok(listRes.body.data.some((u) => u.id === targetUserId));

      const statusRes = await request(app).put(`/api/v1/admin/users/${targetUserId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "suspended" });
      assert.equal(statusRes.status, 200);

      const roleRes = await request(app).put(`/api/v1/admin/users/${targetUserId}/role`).set("Authorization", `Bearer ${adminToken}`).send({ role: employeeRole._id.toString() });
      assert.equal(roleRes.status, 200);

      const verifyRes = await request(app).put(`/api/v1/admin/users/${targetUserId}/verify`).set("Authorization", `Bearer ${adminToken}`);
      assert.equal(verifyRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/users/${targetUserId}`).set("Authorization", `Bearer ${adminToken}`);
      assert.equal(deleteRes.status, 200);
    });
  });

  describe("employees", () => {
    it("creates, updates, and deletes an employee profile for an existing user", async () => {
      const adminToken = await loginAsAdmin(app, "admin2@example.com");
      const targetUserId = await createTargetUser(app, "meta2@example.com");
      // createEmployee (employee.service.js) looks up the "employee" role by name -
      // must exist before the call, same reasoning as api-v1-employee-partner's own
      // loginAsEmployee helper.
      await ensureRole("employee");

      const createRes = await request(app).post("/api/v1/admin/employees").set("Authorization", `Bearer ${adminToken}`).send({ userId: targetUserId, payType: "salary" });
      assert.equal(createRes.status, 201);
      const employeeId = createRes.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/employees/${employeeId}`).set("Authorization", `Bearer ${adminToken}`).send({ isActive: false });
      assert.equal(updateRes.status, 200);

      const hoursRes = await request(app)
        .put(`/api/v1/admin/employees/${employeeId}/working-hours`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ workingHours: [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }] });
      assert.equal(hoursRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/employees/${employeeId}`).set("Authorization", `Bearer ${adminToken}`);
      assert.equal(deleteRes.status, 200);
    });

    it("409s creating a second employee profile for the same user", async () => {
      const adminToken = await loginAsAdmin(app, "admin3@example.com");
      const targetUserId = await createTargetUser(app, "meta3@example.com");
      await ensureRole("employee");

      await request(app).post("/api/v1/admin/employees").set("Authorization", `Bearer ${adminToken}`).send({ userId: targetUserId });
      const res = await request(app).post("/api/v1/admin/employees").set("Authorization", `Bearer ${adminToken}`).send({ userId: targetUserId });

      assert.equal(res.status, 409);
    });
  });

  describe("experts", () => {
    it("requires an image (already-hosted, not uploaded here) to create an expert", async () => {
      const adminToken = await loginAsAdmin(app, "admin4@example.com");
      const res = await request(app).post("/api/v1/admin/experts").set("Authorization", `Bearer ${adminToken}`).send({ firstName: "Ana", lastName: "Anic" });

      // Expert.image is required at the DB level with no default (see
      // expert.model.js) - this API doesn't handle file upload, so a client must
      // already have a hosted image URL to pass. Documenting the constraint, not
      // treating it as a bug.
      assert.equal(res.status, 400);
    });

    it("creates, updates, and deletes an expert when an image is provided", async () => {
      const adminToken = await loginAsAdmin(app, "admin5@example.com");

      const createRes = await request(app)
        .post("/api/v1/admin/experts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ firstName: "Ana", lastName: "Anic", image: { img: "/images/experts/ana.webp", imgDesc: "Ana Anic" } });
      assert.equal(createRes.status, 201);
      const expertId = createRes.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/experts/${expertId}`).set("Authorization", `Bearer ${adminToken}`).send({ title: "Viši terapeut" });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/experts/${expertId}`).set("Authorization", `Bearer ${adminToken}`);
      assert.equal(deleteRes.status, 200);
    });
  });

  describe("partners", () => {
    it("creates, updates, and deletes a partner profile for an existing user", async () => {
      const adminToken = await loginAsAdmin(app, "admin6@example.com");
      const targetUserId = await createTargetUser(app, "meta6@example.com");
      await ensureRole("partner");

      const createRes = await request(app)
        .post("/api/v1/admin/partners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ userId: targetUserId, commissionRateServices: 10, commissionRateProducts: 5 });
      assert.equal(createRes.status, 201);
      const partnerId = createRes.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/partners/${partnerId}`).set("Authorization", `Bearer ${adminToken}`).send({ commissionRateServices: 15 });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/partners/${partnerId}`).set("Authorization", `Bearer ${adminToken}`);
      assert.equal(deleteRes.status, 200);
    });
  });
});
