import { describe, it } from "node:test";
import assert from "node:assert/strict";
import postService from "../../../src/services/post.service.js";
import serviceService from "../../../src/services/service.service.js";
import packageService from "../../../src/services/package.service.js";
import productService from "../../../src/services/product.service.js";
import auditLogService from "../../../src/services/audit-log.service.js";
import { archivePost, deactivateService, deactivatePackage, deactivateProduct } from "../../../src/controllers/web/admin/deactivate.controller.js";

const call = async (handler, params) => {
  const flashes = [];
  let redirect = null;
  const req = { params, session: { user: { id: "u1" }, save: (cb) => cb() }, flash: (...a) => flashes.push(a), headers: {}, get: () => null };
  await handler(req, { redirect: (u) => (redirect = u) }, (e) => { throw e; });
  return { flashes, redirect };
};

describe("soft removal for non-admin roles", () => {
  it("archivePost sets status archived (never deletes)", async (t) => {
    const upd = t.mock.method(postService, "updatePostStatus", async () => ({}));
    t.mock.method(postService, "getPostById", async () => ({ naslov: "N" }));
    const del = t.mock.method(postService, "deletePostById", async () => {});
    const audit = t.mock.method(auditLogService, "recordAuditLog", async () => {});
    const r = await call(archivePost, { postId: "p1" });
    assert.deepEqual(upd.mock.calls[0].arguments, ["p1", "archived"]);
    assert.equal(del.mock.callCount(), 0);
    assert.equal(audit.mock.calls[0].arguments[0].action, "POST_ARCHIVED");
    assert.equal(r.redirect, "/admin/blog");
  });
  for (const [name, handler, svc, fn, getter, params, action, url] of [
    ["service", deactivateService, serviceService, "updateServiceById", "getServiceById", { serviceId: "s1" }, "SERVICE_DEACTIVATED", "/admin/usluge"],
    ["package", deactivatePackage, packageService, "updatePackageById", "getPackageById", { packageId: "k1" }, "PACKAGE_DEACTIVATED", "/admin/paketi"],
    ["product", deactivateProduct, productService, "updateProductById", "getProductById", { productId: "r1" }, "PRODUCT_DEACTIVATED", "/admin/proizvodi"],
  ]) {
    it(`deactivate ${name} only flips isActive`, async (t) => {
      const upd = t.mock.method(svc, fn, async () => ({}));
      t.mock.method(svc, getter, async () => ({ naziv: "X" }));
      const audit = t.mock.method(auditLogService, "recordAuditLog", async () => {});
      const r = await call(handler, params);
      assert.deepEqual(upd.mock.calls[0].arguments[1], { isActive: false });
      assert.equal(audit.mock.calls[0].arguments[0].action, action);
      assert.equal(r.redirect, url);
      assert.equal(r.flashes[0][0], "success");
    });
  }
  it("a failure is flashed, not thrown", async (t) => {
    t.mock.method(serviceService, "getServiceById", async () => ({}));
    t.mock.method(serviceService, "updateServiceById", async () => { const e = new Error("Usluga nije pronađena"); e.statusCode = 404; throw e; });
    const r = await call(deactivateService, { serviceId: "zz" });
    assert.equal(r.flashes[0][0], "error");
  });
});
