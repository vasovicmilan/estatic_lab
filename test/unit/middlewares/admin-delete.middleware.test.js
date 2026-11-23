import { describe, it } from "node:test";
import assert from "node:assert/strict";
import auditLogService from "../../../src/services/audit-log.service.js";
import { requireAdminForDelete } from "../../../src/middlewares/permission.middleware.js";

const run = (req, t) => {
  t.mock.method(auditLogService, "recordAuditLog", async () => {});
  const out = { next: false, redirect: null, err: null, flash: [] };
  const fullReq = { originalUrl: "/admin/blog/1", get: () => null, flash: (...a) => out.flash.push(a), headers: {}, ...req };
  requireAdminForDelete(fullReq, { redirect: (u) => (out.redirect = u) }, (e) => { out.next = true; out.err = e || null; });
  return out;
};

describe("requireAdminForDelete", () => {
  it("lets non-DELETE requests through for everyone", (t) => {
    assert.equal(run({ method: "PUT", user: { roleName: "menadzer bloga" } }, t).next, true);
    assert.equal(run({ method: "GET", user: { roleName: "menadzer bloga" } }, t).next, true);
  });
  it("lets the admin delete", (t) => {
    assert.equal(run({ method: "DELETE", user: { roleName: "admin" } }, t).next, true);
  });
  it("blocks every other role and redirects with a message", (t) => {
    for (const roleName of ["menadzer bloga", "menadzer usluga", "menadzer prodavnice", "user"]) {
      const out = run({ method: "DELETE", user: { roleName } }, t);
      assert.equal(out.next, false, roleName);
      assert.equal(out.redirect, "/admin");
      assert.equal(out.flash[0][0], "error");
    }
  });
  it("blocks a custom role even with every manage permission", (t) => {
    const out = run({ method: "DELETE", user: { roleName: "custom", permissions: ["manage_blog", "manage_products", "manage_services"] } }, t);
    assert.equal(out.next, false);
  });
  it("is audited when denied", (t) => {
    t.mock.method(auditLogService, "recordAuditLog", async () => {});
    const m = auditLogService.recordAuditLog;
    requireAdminForDelete({ method: "DELETE", user: { roleName: "x" }, originalUrl: "/admin/blog/1", get: () => null, flash() {}, headers: {} }, { redirect() {} }, () => {});
    assert.equal(m.mock.callCount(), 1);
    assert.equal(m.mock.calls[0].arguments[0].success, false);
  });
});
