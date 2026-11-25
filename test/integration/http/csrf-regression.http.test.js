import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";

// allowEmptyFooter: anonymous visitors get an empty token in the footer newsletter form on purpose
// (filled in via GET /csrf-token on submit, so a page view creates no session) - the page's own
// form must still carry a real one.
function assertRealCsrfToken(html, pageLabel, { allowEmptyFooter = false } = {}) {
  const matches = [...html.matchAll(/name="CSRFToken" value="([^"]*)"/g)];
  assert.ok(matches.length > 0, `${pageLabel} should render at least one CSRFToken field`);
  for (const match of matches) {
    assert.notEqual(match[1], "undefined", `${pageLabel} rendered the literal string "undefined" as its CSRF token`);
    if (!allowEmptyFooter) assert.notEqual(match[1], "", `${pageLabel} rendered an empty CSRF token`);
  }
  if (allowEmptyFooter) {
    assert.ok(matches.some((m) => m[1] !== ""), `${pageLabel} has no form with a real CSRF token`);
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
    // "/" is not in this list on purpose: anonymous visitors get the token for its footer and
    // testimonial forms lazily (GET /csrf-token on submit) so the home page creates no session.
    const pages = ["/kontakt", "/prijava", "/registracija", "/zaboravljena-lozinka"];

    for (const path of pages) {
      const res = await request(app).get(path);
      assertRealCsrfToken(res.text, path, { allowEmptyFooter: true });
    }

    const home = await request(app).get("/");
    assert.doesNotMatch(home.text, /name="CSRFToken" value="undefined"/, "/ rendered the literal string 'undefined'");
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