import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import Role from "../../../src/models/role.model.js";
import userRepo from "../../../src/repositories/user.repository.js";

async function seedRoles() {
  await Role.create({ name: "admin", isDefault: false, priority: 100 });
  await Role.create({ name: "user", isDefault: true, priority: 0 });
}

function validRegistration(overrides = {}) {
  return {
    email: "prvi@example.com",
    password: "lozinka123",
    passwordConfirm: "lozinka123",
    firstName: "Prvi",
    lastName: "Korisnik",
    ...overrides,
  };
}

describe("auth flow (HTTP)", () => {
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

  describe("GET /registracija / GET /prijava", () => {
    it("renders the registration form", async () => {
      const res = await request(app).get("/registracija");
      assert.equal(res.status, 200);
      assert.match(res.text, /action="\/registracija"/);
    });

    it("renders the login form", async () => {
      const res = await request(app).get("/prijava");
      assert.equal(res.status, 200);
      assert.match(res.text, /action="\/prijava"/);
    });
  });

  describe("POST /registracija", () => {
    it("makes the first-ever registration an auto-active, auto-confirmed admin", async () => {
      await seedRoles();
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/registracija");

      const res = await agent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: token });

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, "/prijava");

      const user = await userRepo.findUserByEmail("prvi@example.com");
      assert.equal(user.status, "active");
      assert.equal(user.confirmed, true);
    });

    it("gives the second registration the normal pending flow", async () => {
      await seedRoles();
      const firstAgent = request.agent(app);
      const { token: firstToken } = await getCsrfToken(firstAgent, "/registracija");
      await firstAgent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: firstToken });

      const secondAgent = request.agent(app);
      const { token: secondToken } = await getCsrfToken(secondAgent, "/registracija");
      const res = await secondAgent
        .post("/registracija")
        .type("form")
        .send({ ...validRegistration({ email: "drugi@example.com" }), CSRFToken: secondToken });

      assert.equal(res.status, 302);
      const user = await userRepo.findUserByEmail("drugi@example.com");
      assert.equal(user.status, "pending");
      assert.equal(user.confirmed, false);
    });

    it("rejects a duplicate email with a 409", async () => {
      await seedRoles();
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/registracija");
      await agent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: token });

      const secondAgent = request.agent(app);
      const { token: token2 } = await getCsrfToken(secondAgent, "/registracija");
      const res = await secondAgent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: token2 });

      assert.equal(res.status, 409);
    });

    it("rejects mismatched passwords with a validation error, before touching the database", async () => {
      const agent = request.agent(app);
      const { token } = await getCsrfToken(agent, "/registracija");

      const res = await agent
        .post("/registracija")
        .type("form")
        .send({ ...validRegistration({ passwordConfirm: "different1" }), CSRFToken: token });

      assert.equal(res.status, 400);
    });
  });

  describe("POST /prijava", () => {
    it("logs in the first (admin) user successfully and establishes a session", async () => {
      await seedRoles();
      const regAgent = request.agent(app);
      const { token: regToken } = await getCsrfToken(regAgent, "/registracija");
      await regAgent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: regToken });

      const loginAgent = request.agent(app);
      const { token: loginToken } = await getCsrfToken(loginAgent, "/prijava");
      const res = await loginAgent
        .post("/prijava")
        .type("form")
        .send({ email: "prvi@example.com", password: "lozinka123", CSRFToken: loginToken });

      assert.equal(res.status, 302);
      assert.equal(res.headers.location, "/");

      // the session should now consider us logged in - a protected admin route should
      // no longer redirect us away to the login page
      const adminRes = await loginAgent.get("/admin");
      assert.notEqual(adminRes.status, 302, "an authenticated admin should not be redirected away from /admin");
    });

    it("rejects a wrong password", async () => {
      await seedRoles();
      const regAgent = request.agent(app);
      const { token: regToken } = await getCsrfToken(regAgent, "/registracija");
      await regAgent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: regToken });

      const loginAgent = request.agent(app);
      const { token: loginToken } = await getCsrfToken(loginAgent, "/prijava");
      const res = await loginAgent
        .post("/prijava")
        .type("form")
        .send({ email: "prvi@example.com", password: "pogresnalozinka", CSRFToken: loginToken });

      assert.equal(res.status, 401);
    });

    it("rejects login for a still-pending (unconfirmed) second-user account", async () => {
      await seedRoles();
      const firstAgent = request.agent(app);
      const { token: firstToken } = await getCsrfToken(firstAgent, "/registracija");
      await firstAgent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: firstToken });

      const secondAgent = request.agent(app);
      const { token: secondToken } = await getCsrfToken(secondAgent, "/registracija");
      await secondAgent
        .post("/registracija")
        .type("form")
        .send({ ...validRegistration({ email: "drugi@example.com" }), CSRFToken: secondToken });

      const loginAgent = request.agent(app);
      const { token: loginToken } = await getCsrfToken(loginAgent, "/prijava");
      const res = await loginAgent
        .post("/prijava")
        .type("form")
        .send({ email: "drugi@example.com", password: "lozinka123", CSRFToken: loginToken });

      assert.equal(res.status, 401);
    });
  });

  describe("GET /odjava", () => {
    it("destroys the session and redirects home", async () => {
      await seedRoles();
      const agent = request.agent(app);
      const { token: regToken } = await getCsrfToken(agent, "/registracija");
      await agent.post("/registracija").type("form").send({ ...validRegistration(), CSRFToken: regToken });

      const { token: loginToken } = await getCsrfToken(agent, "/prijava");
      await agent.post("/prijava").type("form").send({ email: "prvi@example.com", password: "lozinka123", CSRFToken: loginToken });

      const res = await agent.get("/odjava");
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, "/");

      const adminRes = await agent.get("/admin");
      assert.equal(adminRes.status, 302, "after logout, /admin should redirect since we're no longer authenticated");
    });
  });
});