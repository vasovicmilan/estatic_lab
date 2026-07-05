import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin, ensureRole } from "../../helpers/session.js";
import userRepo from "../../../src/repositories/user.repository.js";

describe("admin user management actions (HTTP)", () => {
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

  it("updates a user's status", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "korisnik@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, `/admin/korisnici/detalji/${target._id}`);
    const res = await agent
      .put(`/admin/korisnici/${target._id}/status`)
      .type("form")
      .send({ CSRFToken: token, status: "suspended" });

    assert.equal(res.status, 302);
    const updated = await userRepo.findUserById(target._id);
    assert.equal(updated.status, "suspended");
  });

  it("updates a user's role", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "korisnik2@example.com", roleName: "user" });
    const employeeRole = await ensureRole("employee");

    const { token } = await getCsrfToken(agent, `/admin/korisnici/detalji/${target._id}`);
    const res = await agent
      .put(`/admin/korisnici/${target._id}/rola`)
      .type("form")
      .send({ CSRFToken: token, role: employeeRole._id.toString() });

    assert.equal(res.status, 302);
    const updated = await userRepo.findUserById(target._id);
    assert.equal(String(updated.role), String(employeeRole._id));
  });

  // See the note above: verifyUser calls authService.verifyAccountByAdmin(userId), but
  // the function actually defined (in user.service.js) is verifyUserByAdmin, exported
  // from a different module than the controller imports it from. If auth.service.js
  // doesn't separately provide a same-named function, this should 500 instead of 302 —
  // documenting actual behavior rather than assuming.
  it("manually verifies a pending user's account", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "korisnik3@example.com", roleName: "user" });
    await userRepo.updateUserById(target._id, { status: "pending", confirmed: false });

    const { token } = await getCsrfToken(agent, `/admin/korisnici/detalji/${target._id}`);
    const res = await agent.put(`/admin/korisnici/${target._id}/verifikuj`).type("form").send({ CSRFToken: token });

    assert.equal(res.status, 302);
    const updated = await userRepo.findUserById(target._id);
    assert.equal(updated.confirmed, true);
    assert.equal(updated.status, "active");
  });

  it("deletes a user", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const target = await registerAndLogin(request.agent(app), { email: "korisnik4@example.com", roleName: "user" });

    const { token } = await getCsrfToken(agent, `/admin/korisnici/detalji/${target._id}`);
    const res = await agent.delete(`/admin/korisnici/${target._id}`).set("X-CSRF-Token", token);

    assert.equal(res.status, 302);
    const found = await userRepo.findUserById(target._id);
    assert.equal(found, null);
  });
});