import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import newsLetterRepo from "../../../src/repositories/news-letter.repository.js";

describe("admin newsletter subscriber actions (HTTP)", () => {
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

  it("lists subscribers", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    await newsLetterRepo.createSubscriber({ email: "pretplatnik@example.com", unsubscribeToken: "tok-1" });

    const res = await agent.get("/admin/newsletter");
    assert.equal(res.status, 200);
  });

  it("deletes a subscriber", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const subscriber = await newsLetterRepo.createSubscriber({ email: "za-brisanje@example.com", unsubscribeToken: "tok-2" });

    const { token } = await getCsrfToken(agent, `/admin/newsletter/detalji/${subscriber._id}`);
    const res = await agent.delete(`/admin/newsletter/${subscriber._id}`).set("X-CSRF-Token", token);

    assert.equal(res.status, 302);
    const remaining = await newsLetterRepo.findSubscribers({});
    assert.equal(remaining.data.length, 0);
  });
});