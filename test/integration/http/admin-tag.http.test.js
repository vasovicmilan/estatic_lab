import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import tagRepo from "../../../src/repositories/tag.repository.js";

describe("admin tag CRUD (HTTP)", () => {
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

  it("creates a tag", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");

    const res = await agent.post("/admin/tagovi").type("form").send({
      CSRFToken: token,
      name: "Opustanje",
      domain: "service",
    });

    assert.equal(res.status, 302);
    const result = await tagRepo.findTags({});
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, "Opustanje");
    assert.ok(result.data[0].slug, "a slug should have been auto-generated");
  });

  it("rejects an invalid domain with a re-rendered 400", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");

    const res = await agent.post("/admin/tagovi").type("form").send({
      CSRFToken: token,
      name: "Nevalidan",
      domain: "not-a-real-domain",
    });

    assert.equal(res.status, 400);
    const result = await tagRepo.findTags({});
    assert.equal(result.data.length, 0);
  });

  it("edits an existing tag", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");
    await agent.post("/admin/tagovi").type("form").send({ CSRFToken: createToken, name: "Original", domain: "service" });

    const existing = (await tagRepo.findTags({})).data[0];
    const { token: editToken } = await getCsrfToken(agent, `/admin/tagovi/izmena/${existing._id}`);

    const res = await agent
      .put(`/admin/tagovi/${existing._id}`)
      .type("form")
      .send({ CSRFToken: editToken, name: "Izmenjeno", domain: "service" });

    assert.equal(res.status, 302);
    const updated = await tagRepo.findTagById(existing._id);
    assert.equal(updated.name, "Izmenjeno");
  });

  it("deletes a tag", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const { token: createToken } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");
    await agent.post("/admin/tagovi").type("form").send({ CSRFToken: createToken, name: "Za Brisanje", domain: "service" });

    const existing = (await tagRepo.findTags({})).data[0];
    const { token: deleteToken } = await getCsrfToken(agent, "/admin/tagovi/dodavanje");
    const res = await agent.delete(`/admin/tagovi/${existing._id}`).set("X-CSRF-Token", deleteToken);

    assert.equal(res.status, 302);
    const found = await tagRepo.findTagById(existing._id);
    assert.equal(found, null);
  });
});