import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import resourceRepo from "../../../src/repositories/resource.repository.js";
import expertRepo from "../../../src/repositories/expert.repository.js";
import roleRepo from "../../../src/repositories/role.repository.js";
import auditLogRepo from "../../../src/repositories/audit-log.repository.js";

/**
 * HTTP-level coverage for three admin controllers that were earlier in this
 * session given audit logging (resource, expert, role) but never actually
 * verified through a real HTTP request that the log entry gets written - only
 * checked at the syntax/mapper level at the time. Bundled into one file since
 * each controller is small and the pattern (create -> assert both the record AND
 * its audit log entry exist) repeats identically across all three.
 */
describe("admin resource/expert/role CRUD + audit log (HTTP)", () => {
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

  describe("resources", () => {
    it("creates a resource and records an audit log entry for it", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
      const { token } = await getCsrfToken(agent, "/admin/resursi/dodavanje");

      const res = await agent.post("/admin/resursi").type("form").send({
        CSRFToken: token,
        name: "Soba za masazu 1",
        capacity: 2,
      });

      assert.equal(res.status, 302);
      const found = await resourceRepo.findResources({ search: "Soba za masazu 1" });
      assert.equal(found.data.length, 1);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "RESOURCE_CREATED", entityId: found.data[0]._id.toString() } });
      assert.equal(logs.data.length, 1);
      assert.equal(logs.data[0].success, true);
    });

    it("deletes a resource and records an audit log entry for it", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

      const { token: createToken } = await getCsrfToken(agent, "/admin/resursi/dodavanje");
      await agent.post("/admin/resursi").type("form").send({ CSRFToken: createToken, name: "Soba za brisanje", capacity: 1 });
      const existing = (await resourceRepo.findResources({ search: "Soba za brisanje" })).data[0];

      const { token: deleteToken } = await getCsrfToken(agent, "/admin/resursi/dodavanje");
      const res = await agent.delete(`/admin/resursi/${existing._id}`).set("X-CSRF-Token", deleteToken);

      assert.equal(res.status, 302);
      const found = await resourceRepo.findResourceById(existing._id);
      assert.equal(found, null);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "RESOURCE_DELETED", entityId: existing._id.toString() } });
      assert.equal(logs.data.length, 1);
    });
  });

  describe("experts", () => {
    it("creates an expert and records an audit log entry for it", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
      const { token } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");

      const res = await agent
        .post("/admin/eksperti")
        .field("CSRFToken", token)
        .field("firstName", "Ana")
        .field("lastName", "Anic")
        .field("imageDesc", "Ana Anic profilna slika")
        .attach("expertImage", TINY_PNG, "ana.png");

      assert.equal(res.status, 302);
      const found = await expertRepo.findExperts({ search: "Anic" });
      assert.equal(found.data.length, 1);
      if (found.data[0].image?.img) uploadedImageUrls.push(found.data[0].image.img);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "EXPERT_CREATED", entityId: found.data[0]._id.toString() } });
      assert.equal(logs.data.length, 1);
    });

    it("updates an expert's active status and records an audit log entry with the before/after change", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

      const { token: createToken } = await getCsrfToken(agent, "/admin/eksperti/dodavanje");
      await agent
        .post("/admin/eksperti")
        .field("CSRFToken", createToken)
        .field("firstName", "Marko")
        .field("lastName", "Markovic")
        .field("imageDesc", "Marko Markovic profilna slika")
        .attach("expertImage", TINY_PNG, "marko.png");
      const existing = (await expertRepo.findExperts({ search: "Markovic" })).data[0];
      if (existing.image?.img) uploadedImageUrls.push(existing.image.img);

      const { token: editToken } = await getCsrfToken(agent, `/admin/eksperti/izmena/${existing._id}`);
      const res = await agent
        .put(`/admin/eksperti/${existing._id}`)
        .type("form")
        .send({ CSRFToken: editToken, firstName: "Marko", lastName: "Markovic", isActive: "false" });

      assert.equal(res.status, 302);
      const updated = await expertRepo.findExpertById(existing._id);
      assert.equal(updated.isActive, false);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "EXPERT_UPDATED", entityId: existing._id.toString() } });
      assert.equal(logs.data.length, 1);
      assert.equal(logs.data[0].changes?.isActive?.old, true);
      assert.equal(logs.data[0].changes?.isActive?.new, false);
    });
  });

  describe("roles", () => {
    it("creates a role and records an audit log entry for it", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
      const { token } = await getCsrfToken(agent, "/admin/role/dodavanje");

      const res = await agent.post("/admin/role").type("form").send({
        CSRFToken: token,
        name: "test uloga",
        permissions: ["manage_orders"],
      });

      assert.equal(res.status, 302);
      const found = await roleRepo.findRoleByName("test uloga");
      assert.ok(found);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "ROLE_CREATED", entityId: found._id.toString() } });
      assert.equal(logs.data.length, 1);
    });

    it("updates a role's permissions and records the before/after change - the actual point of auditing this controller", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

      const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
      await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "menjana uloga", permissions: ["manage_orders"] });
      const existing = await roleRepo.findRoleByName("menjana uloga");

      const { token: editToken } = await getCsrfToken(agent, `/admin/role/izmena/${existing._id}`);
      const res = await agent
        .put(`/admin/role/${existing._id}`)
        .type("form")
        .send({ CSRFToken: editToken, name: "menjana uloga", permissions: ["manage_orders", "manage_payouts"] });

      assert.equal(res.status, 302);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "ROLE_UPDATED", entityId: existing._id.toString() } });
      assert.equal(logs.data.length, 1);
      assert.ok(logs.data[0].changes?.permissions, "a permission change on a role must leave a visible before/after trail");
    });

    it("deletes a role and records an audit log entry for it", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

      const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
      await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "uloga za brisanje" });
      const existing = await roleRepo.findRoleByName("uloga za brisanje");

      const { token: deleteToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
      const res = await agent.delete(`/admin/role/${existing._id}`).set("X-CSRF-Token", deleteToken);

      assert.equal(res.status, 302);
      const found = await roleRepo.findRoleByName("uloga za brisanje");
      assert.equal(found, null);

      const logs = await auditLogRepo.findAuditLogs({ filters: { action: "ROLE_DELETED", entityId: existing._id.toString() } });
      assert.equal(logs.data.length, 1);
    });
  });
});