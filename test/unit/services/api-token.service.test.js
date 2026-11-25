import { describe, it } from "node:test";
import assert from "node:assert/strict";
import service, { effectivePermissions, TOKEN_PREFIX, looksLikeApiToken } from "../../../src/services/api-token.service.js";
import apiTokenRepo from "../../../src/repositories/api-token.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import auditLogService from "../../../src/services/audit-log.service.js";
import { sha256 } from "../../../src/services/crypto.service.js";

const activeUser = { _id: "u1", email: "claude@x.rs", status: "active", role: { _id: "r1", name: "claude asistent", permissions: ["access_admin_panel", "manage_blog", "manage_products", "manage_marketing", "manage_users"] } };

function stubCreate(t, user = activeUser) {
  t.mock.method(userRepo, "findUserById", async () => user);
  t.mock.method(auditLogService, "recordAuditLog", async () => {});
  let saved;
  t.mock.method(apiTokenRepo, "createToken", async (data) => {
    saved = data;
    return { ...data, _id: "t1", toObject() { return { ...data, _id: "t1" }; } };
  });
  return () => saved;
}

describe("api-token.service - effectivePermissions", () => {
  it("intersects role permissions with the chosen scopes", () => {
    const perms = effectivePermissions(["access_admin_panel", "manage_blog", "manage_products", "manage_users"], ["blog"]);
    assert.deepEqual(perms.sort(), ["access_admin_panel", "manage_blog"]);
  });
  it("never grants a permission the role lacks", () => {
    assert.deepEqual(effectivePermissions(["access_admin_panel"], ["blog", "catalog", "materials"]), ["access_admin_panel"]);
  });
  it("never lets a scope unlock users/roles/payouts", () => {
    const perms = effectivePermissions(["manage_users", "manage_roles", "manage_payouts", "manage_blog"], ["blog", "catalog", "materials"]);
    assert.deepEqual(perms, ["manage_blog"]);
  });
});

describe("api-token.service - createApiToken", () => {
  it("returns the secret once and stores only its hash", async (t) => {
    const saved = stubCreate(t);
    const { token } = await service.createApiToken({ name: "Claude", userId: "u1", scopes: ["blog"], days: 7, actor: { id: "a1" } });
    assert.ok(token.startsWith(TOKEN_PREFIX));
    assert.equal(saved().tokenHash, sha256(token));
    assert.equal(JSON.stringify(saved()).includes(token), false);
    const days = (saved().expiresAt - Date.now()) / 86400000;
    assert.ok(days > 6.9 && days < 7.1);
  });

  it("rejects durations outside 1-90 days", async (t) => {
    stubCreate(t);
    for (const days of [0, 91, 1.5, "abc"]) {
      await assert.rejects(service.createApiToken({ name: "x", userId: "u1", scopes: ["blog"], days, actor: {} }), /Rok važenja/);
    }
    for (const days of [1, 90]) {
      await service.createApiToken({ name: "x", userId: "u1", scopes: ["blog"], days, actor: {} });
    }
  });

  it("requires a name and at least one valid scope", async (t) => {
    stubCreate(t);
    await assert.rejects(service.createApiToken({ name: " ", userId: "u1", scopes: ["blog"], days: 7, actor: {} }), /Naziv/);
    await assert.rejects(service.createApiToken({ name: "x", userId: "u1", scopes: ["bogus"], days: 7, actor: {} }), /oblast/);
  });

  it("refuses an admin account and inactive accounts", async (t) => {
    stubCreate(t, { ...activeUser, role: { ...activeUser.role, name: "admin" } });
    await assert.rejects(service.createApiToken({ name: "x", userId: "u1", scopes: ["blog"], days: 7, actor: {} }), /administratora/);
    stubCreate(t, { ...activeUser, status: "suspended" });
    await assert.rejects(service.createApiToken({ name: "x", userId: "u1", scopes: ["blog"], days: 7, actor: {} }), /aktivan/);
  });
});

describe("api-token.service - authenticateApiToken", () => {
  const raw = `${TOKEN_PREFIX}abc`;
  const base = { _id: "t1", name: "Claude", user: "u1", scopes: ["blog"], expiresAt: new Date(Date.now() + 86400000), revokedAt: null, createdAt: new Date() };

  function stub(t, { record = base, user = activeUser, paused = false } = {}) {
    t.mock.method(apiTokenRepo, "findByHash", async () => record);
    t.mock.method(apiTokenRepo, "getAccessState", async () => ({ paused }));
    t.mock.method(apiTokenRepo, "touchToken", async () => {});
    t.mock.method(userRepo, "findUserById", async () => user);
    service.invalidatePauseCache();
  }

  it("builds req.user with live, scope-narrowed permissions", async (t) => {
    stub(t);
    const user = await service.authenticateApiToken(raw, { ip: "1.1.1.1" });
    assert.equal(user.via, "api-token");
    assert.equal(user.tokenName, "Claude");
    assert.deepEqual(user.permissions.sort(), ["access_admin_panel", "manage_blog"]);
  });

  it("rejects unknown, revoked and expired tokens", async (t) => {
    stub(t, { record: null });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
    stub(t, { record: { ...base, revokedAt: new Date() } });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
    stub(t, { record: { ...base, expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
  });

  it("rejects when the account is no longer active or became admin", async (t) => {
    stub(t, { user: { ...activeUser, status: "suspended" } });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
    stub(t, { user: { ...activeUser, role: { ...activeUser.role, name: "admin" } } });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
  });

  it("rejects tokens created before the account's tokenValidAfter", async (t) => {
    stub(t, { user: { ...activeUser, tokenValidAfter: new Date(Date.now() + 1000) } });
    await assert.rejects(service.authenticateApiToken(raw), /Token nije validan/);
  });

  it("is blocked entirely while access is paused", async (t) => {
    stub(t, { paused: true });
    await assert.rejects(service.authenticateApiToken(raw), /pauziran/);
  });

  it("reads permissions from the role at every request (role change applies at once)", async (t) => {
    stub(t);
    assert.ok((await service.authenticateApiToken(raw)).permissions.includes("manage_blog"));
    stub(t, { user: { ...activeUser, role: { ...activeUser.role, permissions: ["access_admin_panel"] } } });
    assert.deepEqual((await service.authenticateApiToken(raw)).permissions, ["access_admin_panel"]);
  });
});

describe("api-token.service - site scope and scope updates", () => {
  it("the site scope unlocks only manage_site_content", () => {
    assert.deepEqual(effectivePermissions(["access_admin_panel", "manage_site_content", "manage_blog"], ["site"]).sort(), ["access_admin_panel", "manage_site_content"]);
  });

  it("updates scopes of an active token only", async (t) => {
    t.mock.method(auditLogService, "recordAuditLog", async () => {});
    const future = new Date(Date.now() + 86400000);
    t.mock.method(apiTokenRepo, "findTokenById", async () => ({ _id: "t1", scopes: ["blog"], revokedAt: null, expiresAt: future }));
    const upd = t.mock.method(apiTokenRepo, "updateScopes", async (id, scopes) => ({ _id: id, scopes }));
    await service.updateApiTokenScopes("t1", ["blog", "site", "bogus"], { id: "a1" });
    assert.deepEqual(upd.mock.calls[0].arguments[1], ["blog", "site"]);
    await assert.rejects(service.updateApiTokenScopes("t1", [], { id: "a1" }), /oblast/);
    t.mock.method(apiTokenRepo, "findTokenById", async () => ({ _id: "t1", scopes: ["blog"], revokedAt: new Date(), expiresAt: future }));
    await assert.rejects(service.updateApiTokenScopes("t1", ["blog"], { id: "a1" }));
  });
});

describe("looksLikeApiToken", () => {
  it("only recognises the elk_ prefix", () => {
    assert.equal(looksLikeApiToken("elk_x"), true);
    assert.equal(looksLikeApiToken("eyJhbGciOi"), false);
    assert.equal(looksLikeApiToken(undefined), false);
  });
});
