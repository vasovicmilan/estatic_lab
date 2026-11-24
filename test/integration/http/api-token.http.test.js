import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";
import Role from "../../../src/models/role.model.js";
import userRepo from "../../../src/repositories/user.repository.js";
import apiTokenService from "../../../src/services/api-token.service.js";
import auditLogRepo from "../../../src/repositories/audit-log.repository.js";
import materialRepo from "../../../src/repositories/material.repository.js";
import { removeMaterialFile } from "../../../src/config/material-upload.config.js";
import { assistantRoles } from "../../../src/database/seeds/roles.seed.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

async function setup(app, { scopes = ["blog", "catalog", "materials"], days = 7 } = {}) {
  const agent = request.agent(app);
  const admin = await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

  const def = assistantRoles.find((r) => r.name === "claude asistent");
  const role = await Role.create({ name: def.name, permissions: def.permissions, priority: def.priority });

  const helper = request.agent(app);
  const assistant = await registerAndLogin(helper, { email: "claude@example.com", roleName: "user" });
  await userRepo.updateUserById(assistant._id, { role: role._id, status: "active" });

  const { token, record } = await apiTokenService.createApiToken({ name: "Test token", userId: assistant._id.toString(), scopes, days, actor: { id: admin._id, email: admin.email, roleName: "admin" } });
  return { token, record, admin, assistant, role };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("API tokens (HTTP)", () => {
  let app;
  const storedMaterials = [];

  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp();
  });
  afterEach(async () => {
    await Promise.all(storedMaterials.splice(0).map((n) => removeMaterialFile(n).catch(() => {})));
    apiTokenService.invalidatePauseCache();
    await clearTestDatabase();
  });

  it("lets a token with the blog scope read posts", async () => {
    const { token } = await setup(app);
    const res = await request(app).get("/api/v1/admin/posts").set(auth(token));
    assert.equal(res.status, 200);
  });

  it("blocks routes outside the allowlist even though the role could never reach them anyway", async () => {
    const { token } = await setup(app);
    for (const [method, path] of [["get", "/users"], ["get", "/contacts"], ["get", "/audit-log"], ["delete", "/posts/507f1f77bcf86cd799439011"], ["put", "/posts/507f1f77bcf86cd799439011/status"], ["put", "/newsletter-campaigns/507f1f77bcf86cd799439011/send"]]) {
      const res = await request(app)[method](`/api/v1/admin${path}`).set(auth(token));
      assert.equal(res.status, 403, `${method} ${path}`);
    }
  });

  it("blocks a scope the token was not given", async () => {
    const { token } = await setup(app, { scopes: ["blog"] });
    const res = await request(app).get("/api/v1/admin/products").set(auth(token));
    assert.equal(res.status, 403);
  });

  it("refuses the token on non-admin API routes", async () => {
    const { token } = await setup(app);
    const res = await request(app).get("/api/v1/me").set(auth(token));
    assert.equal(res.status, 401);
  });

  it("forces a service created by a token to stay inactive (draft)", async () => {
    const { token } = await setup(app);
    const res = await request(app).post("/api/v1/admin/services").set(auth(token)).send({ name: "Nova usluga", isActive: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.aktivna, false);
  });

  it("stops working immediately after revoke", async () => {
    const { token, record, admin } = await setup(app);
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 200);
    await apiTokenService.revokeApiToken(record._id.toString(), { id: admin._id, email: admin.email, roleName: "admin" });
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 401);
  });

  it("stops working while access is paused and resumes after", async () => {
    const { token, admin } = await setup(app);
    const actor = { id: admin._id, email: admin.email, roleName: "admin" };
    await apiTokenService.setApiAccessPaused(true, actor);
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 401);
    await apiTokenService.setApiAccessPaused(false, actor);
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 200);
  });

  it("stops working when the account is suspended", async () => {
    const { token, assistant } = await setup(app);
    await userRepo.updateUserById(assistant._id, { status: "suspended" });
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 401);
  });

  it("applies a role change at once (permissions are read live)", async () => {
    const { token, role } = await setup(app);
    await Role.updateOne({ _id: role._id }, { $set: { permissions: ["access_admin_panel"] } });
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 403);
  });

  it("rejects an expired token", async () => {
    const { token, record } = await setup(app);
    const ApiToken = (await import("../../../src/models/api-token.model.js")).default;
    await ApiToken.updateOne({ _id: record._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await request(app).get("/api/v1/admin/posts").set(auth(token))).status, 401);
  });

  it("records the token name in the audit log", async () => {
    const { token } = await setup(app);
    await request(app).post("/api/v1/admin/services").set(auth(token)).send({ name: "Usluga za log" });
    await request(app).delete("/api/v1/admin/posts/507f1f77bcf86cd799439011").set(auth(token));
    const created = await auditLogRepo.findAuditLogs({ filters: { action: "SERVICE_CREATED" } });
    assert.ok(created.data.some((e) => e.actor?.via === "api-token:Test token"));
    const denied = await auditLogRepo.findAuditLogs({ filters: { action: "API_TOKEN_DENIED" } });
    assert.ok(denied.data.length >= 1);
  });

  it("uploads a PDF material as an inactive draft even when isActive=true is sent", async () => {
    const { token } = await setup(app);
    const res = await request(app)
      .post("/api/v1/admin/materials")
      .set(auth(token))
      .field("title", "Katalog 2026")
      .field("isActive", "true")
      .attach("file", PDF, { filename: "katalog.pdf", contentType: "application/pdf" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const stored = await materialRepo.findMaterialById(res.body.data.id);
    if (stored?.file?.storedName) storedMaterials.push(stored.file.storedName);
    assert.equal(stored.isActive, false);
  });

  it("cannot delete a material", async () => {
    const { token } = await setup(app);
    const res = await request(app).delete("/api/v1/admin/materials/507f1f77bcf86cd799439011").set(auth(token));
    assert.equal(res.status, 403);
  });
});
