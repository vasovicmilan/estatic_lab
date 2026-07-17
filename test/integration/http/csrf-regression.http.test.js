import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";

function assertRealCsrfToken(html, pageLabel) {
  const matches = [...html.matchAll(/name="CSRFToken" value="([^"]*)"/g)];
  assert.ok(matches.length > 0, `${pageLabel} should render at least one CSRFToken field`);
  for (const match of matches) {
    const value = match[1];
    assert.notEqual(value, "undefined", `${pageLabel} rendered the literal string "undefined" as its CSRF token`);
    assert.notEqual(value, "", `${pageLabel} rendered an empty CSRF token`);
  }
}

describe("CSRF token regression sweep (HTTP)", () => {
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

  it("every public form page renders a real CSRF token, not the literal string 'undefined'", async () => {
    const pages = ["/", "/kontakt", "/prijava", "/registracija", "/zaboravljena-lozinka"];

    for (const path of pages) {
      const res = await request(app).get(path);
      assertRealCsrfToken(res.text, path);
    }
  });

  it("every admin 'new record' form page renders a real CSRF token", async () => {
    const agent = request.agent(app);
    // registerAndLogin's ensureRole("admin") grants every permission in PERMISSIONS
    // (see test/helpers/session.js) - needed now that /admin is permission-gated,
    // not roleName-gated (see admin.middleware.js / admin.routes.js)
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const adminPages = [
      "/admin/kategorije/dodavanje",
      "/admin/kuponi/dodavanje",
      "/admin/role/dodavanje",
      "/admin/eksperti/dodavanje",
    ];

    for (const path of adminPages) {
      const res = await agent.get(path);
      assertRealCsrfToken(res.text, path);
    }
  });
});