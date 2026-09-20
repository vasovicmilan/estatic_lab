import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp } from "../setup/test-app.js";

// helmet.config.js sets Cross-Origin-Resource-Policy: same-site globally,
// which the browser enforces on cross-origin <img>/<link>/font loads
// independently of CORS - it would otherwise block a separate frontend (the
// Angular app) from loading images, built CSS/JS, or user uploads served
// from src/public, even once CORS_ORIGINS is set correctly. static.config.js
// overrides the header specifically on express.static's own responses, via
// its setHeaders hook, so this suite pins that behavior down and guards
// against it silently regressing to a blanket app.use(...) that would also
// (wrongly) loosen the header on HTML pages or /api JSON.
describe("static assets are cross-origin embeddable, without loosening HTML/API responses", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  it("serves a public asset (favicon) with a cross-origin CORP and a wildcard ACAO", async () => {
    const res = await request(app).get("/favicon.ico");
    assert.equal(res.status, 200);
    assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
    assert.equal(res.headers["access-control-allow-origin"], "*");
  });

  it("serves the bootstrap JS static route with the same cross-origin headers", async () => {
    const res = await request(app).get("/bootstrap/js/bootstrap.bundle.min.js");
    assert.equal(res.status, 200);
    assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
    assert.equal(res.headers["access-control-allow-origin"], "*");
  });

  it("leaves an HTML page response at helmet's stricter default (same-site, no wildcard ACAO)", async () => {
    const res = await request(app).get("/");
    assert.equal(res.headers["cross-origin-resource-policy"], "same-site");
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  it("does not add a wildcard ACAO to /api responses - those stay origin-restricted", async () => {
    // /api/v1/team is public and unconditional (no requireModule gate) - any
    // such endpoint works here, since this is about response headers, not
    // the endpoint's own business logic.
    const res = await request(app).get("/api/v1/team");
    assert.notEqual(res.headers["access-control-allow-origin"], "*");
  });
});
