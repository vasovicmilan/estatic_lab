import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAuditActor, buildSystemActor } from "../../../src/utils/audit-actor.util.js";

describe("audit-actor.util", () => {
  describe("buildAuditActor", () => {
    it("takes actor straight from req.user, defaulting success to true", () => {
      const req = { user: { id: "u1", email: "a@b.com", roleName: "admin" } };

      const result = buildAuditActor(req);

      assert.equal(result.actor, req.user);
      assert.equal(result.req, req);
      assert.equal(result.success, true);
    });

    it("lets overrides replace success/errorMessage for a failed-action entry", () => {
      const req = { user: { id: "u1" } };

      const result = buildAuditActor(req, { success: false, errorMessage: "boom" });

      assert.equal(result.success, false);
      assert.equal(result.errorMessage, "boom");
      assert.equal(result.actor, req.user);
    });
  });

  describe("buildSystemActor", () => {
    it("returns a null-id/email actor with role 'system' and success:true by default", () => {
      const result = buildSystemActor();

      assert.deepEqual(result.actor, { id: null, email: null, role: "system" });
      assert.equal(result.success, true);
      // No req to pull ip/userAgent/requestId from - a system actor genuinely has none.
      assert.equal(result.req, undefined);
    });

    it("lets overrides mark a failed system-triggered entry", () => {
      const result = buildSystemActor({ success: false, errorMessage: "sync failed" });

      assert.equal(result.success, false);
      assert.equal(result.errorMessage, "sync failed");
      assert.deepEqual(result.actor, { id: null, email: null, role: "system" });
    });
  });
});
