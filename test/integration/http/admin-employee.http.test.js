import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";

describe("admin employee CRUD (HTTP)", () => {
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

  it("creates an employee profile linked to an existing user, promoting their role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await ensureRole("employee"); // createEmployee needs this to exist to promote the target user

    const targetUser = await registerAndLogin(request.agent(app), { email: "buduci-zaposleni@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    const res = await agent.post("/admin/zaposleni").type("form").send({
      CSRFToken: token,
      userId: targetUser._id.toString(),
    });

    assert.equal(res.status, 302);

    const created = await employeeRepo.findEmployeeByUserId(targetUser._id);
    assert.ok(created);
    assert.equal(created.isActive, true);

    const promotedUser = await userRepo.findUserById(targetUser._id);
    const employeeRole = await ensureRole("employee");
    assert.equal(String(promotedUser.role), String(employeeRole._id));
  });

  it("rejects creating a second employee profile for the same user", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await ensureRole("employee");

    const targetUser = await registerAndLogin(request.agent(app), { email: "zaposleni2@example.com", roleName: "user" });

    const { token: token1 } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    await agent.post("/admin/zaposleni").type("form").send({ CSRFToken: token1, userId: targetUser._id.toString() });

    const { token: token2 } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    const res = await agent.post("/admin/zaposleni").type("form").send({ CSRFToken: token2, userId: targetUser._id.toString() });

    assert.equal(res.status, 409);
  });

  it("updates an employee's active status and notes", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await ensureRole("employee");

    const targetUser = await registerAndLogin(request.agent(app), { email: "zaposleni3@example.com", roleName: "user" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    await agent.post("/admin/zaposleni").type("form").send({ CSRFToken: createToken, userId: targetUser._id.toString() });

    const created = await employeeRepo.findEmployeeByUserId(targetUser._id);

    const { token: editToken } = await getCsrfToken(agent, `/admin/zaposleni/izmena/${created._id}`);
    const res = await agent
      .put(`/admin/zaposleni/${created._id}`)
      .type("form")
      .send({ CSRFToken: editToken, isActive: "false", notes: "Na bolovanju" });

    assert.equal(res.status, 302);
    const updated = await employeeRepo.findEmployeeById(created._id);
    assert.equal(updated.isActive, false);
    assert.equal(updated.notes, "Na bolovanju");
  });

  it("updates an employee's working hours as admin, bypassing the ownership check", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await ensureRole("employee");

    const targetUser = await registerAndLogin(request.agent(app), { email: "zaposleni4@example.com", roleName: "user" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    await agent.post("/admin/zaposleni").type("form").send({ CSRFToken: createToken, userId: targetUser._id.toString() });

    const created = await employeeRepo.findEmployeeByUserId(targetUser._id);

    const { token: whToken } = await getCsrfToken(agent, `/admin/zaposleni/izmena/${created._id}`);
    const res = await agent.put(`/admin/zaposleni/${created._id}/radno-vreme`).type("form").send({
      CSRFToken: whToken,
      "workingHours[0][day]": "monday",
      "workingHours[0][slots][0][from]": "09:00",
      "workingHours[0][slots][0][to]": "17:00",
    });

    assert.equal(res.status, 302);
    const updated = await employeeRepo.findEmployeeById(created._id);
    assert.equal(updated.workingHours.length, 1);
  });

  it("deletes an employee", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await ensureRole("employee");

    const targetUser = await registerAndLogin(request.agent(app), { email: "zaposleni5@example.com", roleName: "user" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    await agent.post("/admin/zaposleni").type("form").send({ CSRFToken: createToken, userId: targetUser._id.toString() });

    const created = await employeeRepo.findEmployeeByUserId(targetUser._id);

    const { token: deleteToken } = await getCsrfToken(agent, "/admin/zaposleni/dodavanje");
    const res = await agent.delete(`/admin/zaposleni/${created._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await employeeRepo.findEmployeeById(created._id);
    assert.equal(found, null);
  });
});