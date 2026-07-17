import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import roleRepo from "../../../src/repositories/role.repository.js";

// Uses "recepcija" as a throwaway generic role name for ordinary CRUD tests -
// deliberately NOT "employee"/"admin"/"user". Those three are RESERVED
// (role.service.js blocks renaming/deleting them, since they're looked up by literal
// string elsewhere - see role.model.js), so using one of them as a generic "some role
// to create/rename/delete" fixture will correctly fail those operations now. The
// reserved-name protection itself gets its own dedicated test below instead.
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
      name: "recepcija",
      description: "Recepcija salona",
      "permissions[0]": "view_dashboard",
    });

    assert.equal(res.status, 302);
    const result = await roleRepo.findRoles({});
    const created = result.data.find((r) => r.name === "recepcija");
    assert.ok(created);
  });

  it("rejects a duplicate role name", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: token1 } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: token1, name: "recepcija" });

    const { token: token2 } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.post("/admin/role").type("form").send({ CSRFToken: token2, name: "recepcija" });

    assert.equal(res.status, 409);
  });

  it("updates a role's description and priority", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "recepcija" });

    const existing = (await roleRepo.findRoles({})).data.find((r) => r.name === "recepcija");
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

  it("deletes a non-default, non-reserved role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    await agent.post("/admin/role").type("form").send({ CSRFToken: createToken, name: "recepcija" });

    const existing = (await roleRepo.findRoles({})).data.find((r) => r.name === "recepcija");

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.delete(`/admin/role/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await roleRepo.findRoleById(existing._id);
    assert.equal(found, null);
  });

  it("refuses to delete a reserved role (admin/employee/user), even one not marked isDefault", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const employeeRole = await ensureRole("employee");

    const { token } = await getCsrfToken(agent, "/admin/role/dodavanje");
    const res = await agent.delete(`/admin/role/${employeeRole._id}`).set("X-CSRF-Token", token);

    assert.equal(res.status, 302); // flash-redirected with an error, not a raw 400
    const stillExists = await roleRepo.findRoleById(employeeRole._id);
    assert.ok(stillExists);
  });

  it("refuses to rename a reserved role, even to another valid-looking name", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const employeeRole = await ensureRole("employee");

    const { token } = await getCsrfToken(agent, `/admin/role/izmena/${employeeRole._id}`);
    const res = await agent
      .put(`/admin/role/${employeeRole._id}`)
      .type("form")
      .send({ CSRFToken: token, name: "not-employee-anymore" });

    assert.equal(res.status, 400);
    const unchanged = await roleRepo.findRoleById(employeeRole._id);
    assert.equal(unchanged.name, "employee");
  });
});