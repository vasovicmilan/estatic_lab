import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import roleRepo from "../../../src/repositories/role.repository.js";

describe("admin role CRUD (HTTP)", () => {
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

  it("creates a role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/role/dodavanje");

    const res = await agent.post("/admin/role").type("form").send({
      CSRFToken: token,
      name: "employee",
      description: "Zaposleni u salonu",
      "permissions[0]": "view_dashboard",
    });

    if (res.status === 400) {
      const matches = [...res.text.matchAll(/(?:invalid-feedback|text-danger)[^>]*>([^<]+)</g)];
    }
    assert.equal(res.status, 302);
    const result = await roleRepo.findRoles({});
    const created = result.data.find((r) => r.name === "employee");
    assert.ok(created);
  });

  it("rejects a duplicate role name", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: token1 } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: token1, name: "employee" });

    const { token: token2 } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.post("/admin/role").type("form").send({ CSRFToken: token2, name: "employee" });

    assert.equal(res.status, 409);
  });

  it("updates a role's description and priority", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "employee" });

    const existing = (await roleRepo.findRoles({})).data.find((r) => r.name === "employee");
    const { token: editToken } = await getCsrfToken(agent, `/admin/role/izmena/${existing._id}`);

    const res = await agent
      .put(`/admin/role/${existing._id}`)
      .type("form")
      .send({ CSRFToken: editToken, description: "Novi opis", priority: 50 });

    assert.equal(res.status, 302);
    const updated = await roleRepo.findRoleById(existing._id);
    assert.equal(updated.description, "Novi opis");
    assert.equal(updated.priority, 50);
  });

  it("refuses to delete the default role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    // registerAndLogin's ensureRole helper seeds "user" as isDefault: true
    await registerAndLogin(request.agent(app), { email: "korisnik@example.com", roleName: "user" });

    const defaultRole = (await roleRepo.findRoles({})).data.find((r) => r.name === "user");

    const { token } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.delete(`/admin/role/${defaultRole._id}`).set("X-CSRF-Token", token);

    assert.equal(res.status, 302); // flash-redirected with an error, not a raw 400
    const stillExists = await roleRepo.findRoleById(defaultRole._id);
    assert.ok(stillExists);
  });

  it("deletes a non-default role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "employee" });

    const existing = (await roleRepo.findRoles({})).data.find((r) => r.name === "employee");

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.delete(`/admin/role/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await roleRepo.findRoleById(existing._id);
    assert.equal(found, null);
  });
});