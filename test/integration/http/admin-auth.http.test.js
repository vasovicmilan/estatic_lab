import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import Role from "../../../src/models/role.model.js";
import userRepo from "../../../src/repositories/user.repository.js";

async function seedRoles() {
  const admin = await Role.create({ name: "admin", isDefault: false, priority: 100 });
  const employee = await Role.create({ name: "employee", isDefault: false, priority: 50 });
  const user = await Role.create({ name: "user", isDefault: true, priority: 0 });
  return { admin, employee, user };
}

async function registerAndActivate(agent, { email, roleId }) {
  const { token } = await getCsrfToken(agent, "/registracija");
  await agent.post("/registracija").type("form").send({
    CSRFToken: token,
    email,
    password: "lozinka123",
    passwordConfirm: "lozinka123",
    firstName: "Test",
    lastName: "Korisnik",
  });

  // real registration leaves non-first accounts "pending" until email verification —
  // bypass that step directly at the repo level so we can log in for this test, and
  // reassign the role to whichever one this test actually needs to exercise
  const user = await userRepo.findUserByEmail(email);
  await userRepo.updateUserById(user._id, { status: "active", confirmed: true, role: roleId });

  const { token: loginToken } = await getCsrfToken(agent, "/prijava");
  await agent.post("/prijava").type("form").send({ email, password: "lozinka123", CSRFToken: loginToken });
}

describe("admin access control (HTTP)", () => {
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

  it("redirects an unauthenticated visitor to login, preserving the intended destination", async () => {
    const res = await request(app).get("/admin/kategorije");

    assert.equal(res.status, 302);
    assert.match(res.headers.location, /^\/prijava\?redirect=/);
    assert.match(decodeURIComponent(res.headers.location), /\/admin\/kategorije/);
  });

  it("forbids a logged-in plain 'user' from the admin panel", async () => {
    const { user } = await seedRoles();
    const agent = request.agent(app);
    await registerAndActivate(agent, { email: "korisnik@example.com", roleId: user._id });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 403);
  });

  it("forbids a logged-in employee from the admin panel", async () => {
    const { employee } = await seedRoles();
    const agent = request.agent(app);
    await registerAndActivate(agent, { email: "zaposleni@example.com", roleId: employee._id });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 403);
  });

  it("allows a logged-in admin through to the admin panel", async () => {
    const { admin } = await seedRoles();
    const agent = request.agent(app);
    await registerAndActivate(agent, { email: "admin2@example.com", roleId: admin._id });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 200);
  });
});