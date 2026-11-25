import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiTokenGuard } from "../../../src/middlewares/api-token-guard.middleware.js";
import auditLogService from "../../../src/services/audit-log.service.js";

function run(t, { method, path, scopes, body, via = "api-token" }) {
  const viaValue = via === "none" ? undefined : via;
  t.mock.method(auditLogService, "recordAuditLog", async () => {});
  const req = { method, path, originalUrl: `/api/v1/admin${path}`, body, user: { id: "u1", via: viaValue, scopes, tokenId: "t1", tokenName: "Claude" } };
  let error = "none";
  apiTokenGuard(req, {}, (e) => { error = e; });
  return { req, error };
}

describe("api-token-guard", () => {
  it("passes ordinary (non-token) users untouched", (t) => {
    const { error, req } = run(t, { method: "DELETE", path: "/posts/1", scopes: [], via: "none", body: {} });
    assert.equal(error, undefined);
    assert.equal(req.apiTokenDraft, undefined);
  });

  it("forces posts created by a token to draft and drops scheduling", (t) => {
    const { error, req } = run(t, { method: "POST", path: "/posts", scopes: ["blog"], body: { title: "x", status: "published", scheduledFor: "2030-01-01T10:00" } });
    assert.equal(error, undefined);
    assert.equal(req.body.status, "draft");
    assert.equal(req.body.scheduledFor, undefined);
  });

  it("forces an edit of a published post back to draft", (t) => {
    const { req, error } = run(t, { method: "PUT", path: "/posts/abc", scopes: ["blog"], body: { status: "published" } });
    assert.equal(error, undefined);
    assert.equal(req.body.status, "draft");
  });

  for (const path of ["/services", "/packages", "/products", "/services/123", "/packages/123", "/products/123"]) {
    for (const method of path.split("/").length > 2 ? ["PUT"] : ["POST"]) {
      it(`forces isActive=false on ${method} ${path}`, (t) => {
        const { req, error } = run(t, { method, path, scopes: ["catalog"], body: { isActive: true } });
        assert.equal(error, undefined);
        assert.equal(req.body.isActive, false);
      });
    }
  }

  it("flags materials as draft for the multipart controller", (t) => {
    const { req, error } = run(t, { method: "POST", path: "/materials", scopes: ["materials"], body: undefined });
    assert.equal(error, undefined);
    assert.equal(req.apiTokenDraft, "active");
  });

  it("allows image uploads for the matching scope only", (t) => {
    assert.equal(run(t, { method: "POST", path: "/uploads/posts", scopes: ["blog"], body: {} }).error, undefined);
    assert.equal(run(t, { method: "POST", path: "/uploads/products/gallery", scopes: ["catalog"], body: {} }).error, undefined);
    assert.equal(run(t, { method: "POST", path: "/uploads/products", scopes: ["blog"], body: {} }).error.statusCode, 403);
  });

  it("rejects a route whose scope the token does not have", (t) => {
    assert.equal(run(t, { method: "POST", path: "/products", scopes: ["blog"], body: {} }).error.statusCode, 403);
  });

  const forbidden = [
    ["PUT", "/posts/1/status"],
    ["PUT", "/posts/1/seo"],
    ["DELETE", "/posts/1"],
    ["DELETE", "/products/1"],
    ["DELETE", "/materials/1"],
    ["PUT", "/newsletter-campaigns/1/send"],
    ["POST", "/newsletter-campaigns"],
    ["GET", "/users"],
    ["POST", "/users"],
    ["GET", "/contacts"],
    ["GET", "/audit-log"],
    ["POST", "/roles"],
    ["PUT", "/payout-requests/1/pay"],
    ["PUT", "/site-content/o-nama"],
    ["POST", "/coupons"],
    ["POST", "/api-tokens"],
    ["GET", "/orders"],
    ["POST", "/uploads/site"],
  ];
  for (const [method, path] of forbidden) {
    it(`blocks ${method} ${path} even with every scope`, (t) => {
      const { error } = run(t, { method, path, scopes: ["blog", "catalog", "materials"], body: {} });
      assert.equal(error.statusCode, 403);
    });
  }

  it("records a denied attempt in the audit log", (t) => {
    const audit = t.mock.method(auditLogService, "recordAuditLog", async () => {});
    const req = { method: "DELETE", path: "/posts/1", originalUrl: "/api/v1/admin/posts/1", body: {}, user: { id: "u1", via: "api-token", scopes: ["blog"] } };
    apiTokenGuard(req, {}, () => {});
    assert.equal(audit.mock.callCount(), 1);
    assert.equal(audit.mock.calls[0].arguments[0].action, "API_TOKEN_DENIED");
  });

  it("allows editing site texts only with the site scope, and never the legal pages", (t) => {
    for (const slug of ["o-nama", "faq", "partnerski-program", "pocetna-uvod", "zasto-mi", "pocetna-hero", "usluge-uvod", "paketi-uvod", "prodavnica-uvod", "blog-uvod", "kontakt", "seo-stranica", "tim-uvod"]) {
      assert.equal(run(t, { method: "PUT", path: `/site-content/${slug}`, scopes: ["site"], body: {} }).error, undefined, slug);
      assert.equal(run(t, { method: "PUT", path: `/site-content/${slug}`, scopes: ["blog", "catalog", "materials"], body: {} }).error.statusCode, 403, slug);
    }
    assert.equal(run(t, { method: "GET", path: "/site-content", scopes: ["site"], body: {} }).error, undefined);
    for (const slug of ["politika-privatnosti", "uslovi-koriscenja"]) {
      assert.equal(run(t, { method: "PUT", path: `/site-content/${slug}`, scopes: ["site", "blog", "catalog", "materials"], body: {} }).error.statusCode, 403, slug);
    }
  });

  it("lists only active categories for a token", (t) => {
    const { req, error } = run(t, { method: "GET", path: "/categories", scopes: ["catalog"], body: {} });
    assert.equal(error, undefined);
    assert.equal(req.query.isActive, "true");
  });
  for (const path of ["/categories", "/tags"]) {
    for (const scope of ["blog", "catalog"]) {
      it(`creates ${path} as inactive for a ${scope} token`, (t) => {
        const { req, error } = run(t, { method: "POST", path, scopes: [scope], body: { name: "x", isActive: true } });
        assert.equal(error, undefined);
        assert.equal(req.body.isActive, false);
      });
    }
  }

  it("editing a category cannot change activity, priority, domain or parent", (t) => {
    const { req, error } = run(t, { method: "PUT", path: "/categories/abc", scopes: ["catalog"], body: { name: "Novo", isActive: true, priority: 5, domain: "blog", parent: "p1" } });
    assert.equal(error, undefined);
    assert.deepEqual(req.body, { name: "Novo" });
  });

  it("editing a tag cannot change activity or domain", (t) => {
    const { req, error } = run(t, { method: "PUT", path: "/tags/abc", scopes: ["blog"], body: { name: "Novo", isActive: false, domain: "service" } });
    assert.equal(error, undefined);
    assert.deepEqual(req.body, { name: "Novo" });
  });

  for (const path of ["/categories/abc", "/tags/abc"]) {
    it(`never deletes ${path}`, (t) => {
      const { error } = run(t, { method: "DELETE", path, scopes: ["blog", "catalog", "site", "materials"], body: {} });
      assert.equal(error.statusCode, 403);
    });
  }

  it("a token can list its own inactive categories when it asks for them explicitly", (t) => {
    const { req, error } = run(t, { method: "GET", path: "/categories", scopes: ["catalog"], body: {} });
    assert.equal(error, undefined);
    const explicit = { method: "GET", path: "/categories", originalUrl: "/api/v1/admin/categories", body: {}, query: { isActive: "false" }, user: { id: "u", via: "api-token", scopes: ["catalog"], tokenId: "t", tokenName: "c" } };
    t.mock.method(auditLogService, "recordAuditLog", async () => {});
    apiTokenGuard(explicit, {}, () => {});
    assert.equal(explicit.query.isActive, "false");
    assert.equal(req.query.isActive, "true");
  });
});
