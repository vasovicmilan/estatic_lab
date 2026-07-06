import { describe, it, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import Role from "../../../src/models/role.model.js";

describe("Google OAuth callback (HTTP)", () => {
  let app;
  let originalFetch;

  before(async () => {
    app = await createTestApp();
    originalFetch = global.fetch;
  });

  after(async () => {
    global.fetch = originalFetch;
    await closeTestApp();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await clearTestDatabase();
  });

  it("redirects to Google's OAuth consent screen", async () => {
    const res = await request(app).get("/prijava/google");
    assert.equal(res.status, 302);
    assert.match(res.headers.location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  });

  it("redirects back to login with a flash error when the callback is missing the authorization code", async () => {
    const agent = request.agent(app);
    await agent.get("/prijava/google");
    const res = await agent.get("/prijava/google/callback");

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/prijava");
  });

  it("redirects back to login with a flash error when Google's token exchange fails", async () => {
    global.fetch = mock.fn(async () => ({ ok: false, json: async () => ({}) }));

    const agent = request.agent(app);
    const initial = await agent.get("/prijava/google");
    const state = new URL(initial.headers.location).searchParams.get("state");
    const res = await agent.get(`/prijava/google/callback?code=fake-code&state=${state}`);


    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/prijava");
  });

  it("logs the user in when the token exchange and profile fetch both succeed", async () => {
    await Role.create({ name: "admin", isDefault: false, priority: 100 });

    global.fetch = mock.fn(async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "fake-access-token" }) };
      }
      if (String(url).includes("googleapis.com/oauth2/v2/userinfo")) {
        return {
          ok: true,
          json: async () => ({
            id: "google-123",
            email: "google-user@example.com",
            given_name: "Gugl",
            family_name: "Korisnik",
            picture: "",
          }),
        };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const agent = request.agent(app);
    const res = await agent.get("/prijava/google/callback?code=real-code");

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/");

    // the session should now be authenticated — a request to /admin should no longer
    // be bounced to login (it may still 403 if this account isn't admin, which is fine;
    // we're only confirming the session itself was established)
    const adminCheck = await agent.get("/admin");
    assert.notEqual(adminCheck.status, 302);
  });
});