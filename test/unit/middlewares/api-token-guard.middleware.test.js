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
});
