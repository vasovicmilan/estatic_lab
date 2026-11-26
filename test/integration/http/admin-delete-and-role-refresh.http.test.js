import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import Role from "../../../src/models/role.model.js";
import Tag from "../../../src/models/tag.model.js";
import { SESSION_RECHECK_MS } from "../../../src/middlewares/auth.middleware.js";

const MANAGER = "menadzer taksonomije";

async function createManagerRole() {
  return Role.create({ name: MANAGER, priority: 10, permissions: ["access_admin_panel", "manage_taxonomy"] });
}

const createTag = () => Tag.create({ name: "Probni tag", slug: "probni-tag", domain: "post" });

async function apiLogin(app, email) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: "lozinka123" });
  return res.body.data.token;
}

describe("trajno brisanje i izmena dozvola role (HTTP)", () => {
  let app;
  before(async () => { app = await createTestApp(); });
  after(async () => { await closeTestApp(); });
  afterEach(async () => { await clearTestDatabase(); });

  it("web panel: a manager with the matching permission still cannot hard-delete", async () => {
    await createManagerRole();
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "menadzer@example.com", roleName: MANAGER });
    const tag = await createTag();
    const { token } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");

    // isti oblik zahteva kao forma u panelu: POST + _method=DELETE
    const res = await agent.post(`/admin/tagovi/${tag._id}`).type("form").send({ _method: "DELETE", CSRFToken: token });

    assert.equal(res.status, 302);
    assert.ok(await Tag.findById(tag._id), "tag mora i dalje da postoji");
  });

  it("web panel: the admin can still hard-delete", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const tag = await createTag();
    const { token } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");

    const res = await agent.post(`/admin/tagovi/${tag._id}`).type("form").send({ _method: "DELETE", CSRFToken: token });

    assert.equal(res.status, 302);
    assert.equal(await Tag.findById(tag._id), null);
  });

  it("API: a token issued before a role edit loses the removed permission on the next request", async () => {
    const role = await createManagerRole();
    await registerAndLogin(request.agent(app), { email: "menadzer@example.com", roleName: MANAGER });
    const token = await apiLogin(app, "menadzer@example.com");
    const list = () => request(app).get("/api/v1/admin/tags").set("Authorization", `Bearer ${token}`);
    assert.equal((await list()).status, 200);

    await Role.updateOne({ _id: role._id }, { permissions: ["access_admin_panel"] });

    assert.equal((await list()).status, 403);
  });

  it("web: an open session picks up the role edit after the recheck window, without being logged out", async (t) => {
    const role = await createManagerRole();
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "menadzer@example.com", roleName: MANAGER });
    assert.equal((await agent.get("/admin/tagovi")).status, 200);

    await Role.updateOne({ _id: role._id }, { permissions: ["access_admin_panel"] });
    const realNow = Date.now.bind(Date);
    t.mock.method(Date, "now", () => realNow() + SESSION_RECHECK_MS + 1000);

    assert.equal((await agent.get("/admin/tagovi")).status, 403);
    assert.equal((await agent.get("/admin")).status, 200, "i dalje je prijavljen");
  });

  it("web: a newly granted permission also applies without a new login", async (t) => {
    const role = await createManagerRole();
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "menadzer@example.com", roleName: MANAGER });
    assert.equal((await agent.get("/admin/role")).status, 403);

    await Role.updateOne({ _id: role._id }, { $push: { permissions: "manage_roles" } });
    const realNow = Date.now.bind(Date);
    t.mock.method(Date, "now", () => realNow() + SESSION_RECHECK_MS + 1000);

    assert.equal((await agent.get("/admin/role")).status, 200);
  });
});
