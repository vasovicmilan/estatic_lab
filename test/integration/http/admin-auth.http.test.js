import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";

// Uses the shared registerAndLogin/ensureRole helper (test/helpers/session.js)
// instead of hand-rolling its own Role.create() calls — a locally duplicated
// "admin" role with no permissions was exactly the bug that caused
// "allows a logged-in admin through to the admin panel" to fail with 403 instead
// of 200 once access became permission-based (see admin.middleware.js). Routing
// through the one shared helper means this can't drift out of sync again.
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
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "korisnik@example.com", roleName: "user" });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 403);
  });

  it("forbids a logged-in employee from the admin panel", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "zaposleni@example.com", roleName: "employee" });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 403);
  });

  it("allows a logged-in admin through to the admin panel", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin2@example.com", roleName: "admin" });

    const res = await agent.get("/admin/kategorije");

    assert.equal(res.status, 200);
  });
});