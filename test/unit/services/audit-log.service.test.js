import { describe, it } from "node:test";
import assert from "node:assert/strict";
import auditLogRepo from "../../../src/repositories/audit-log.repository.js";
import * as auditLogService from "../../../src/services/audit-log.service.js";

describe("audit-log.service", () => {
  describe("computeChanges", () => {
    it("returns null (not {}) when nothing tracked actually changed", () => {
      const result = auditLogService.computeChanges({ name: "X", price: 100 }, { name: "X", price: 100 }, ["name", "price"]);
      assert.equal(result, null);
    });

    it("returns only the fields that actually changed, ignoring untracked fields entirely", () => {
      const oldObj = { name: "Stara", price: 100, updatedAt: new Date("2026-01-01") };
      const newObj = { name: "Nova", price: 100, updatedAt: new Date("2026-01-02") };

      const result = auditLogService.computeChanges(oldObj, newObj, ["name", "price"]);

      assert.deepEqual(result, { name: { old: "Stara", new: "Nova" } });
      assert.ok(!("updatedAt" in result), "updatedAt wasn't in trackedFields and must not appear");
    });

    it("compares Date fields by timestamp value, not by reference/object identity", () => {
      const sameInstant = new Date("2026-06-01T10:00:00Z");
      const result = auditLogService.computeChanges(
        { scheduledAt: new Date(sameInstant) },
        { scheduledAt: new Date(sameInstant) }, // different Date object, same instant
        ["scheduledAt"]
      );
      assert.equal(result, null, "two different Date objects representing the same instant must count as unchanged");
    });

    it("detects a real Date change", () => {
      const result = auditLogService.computeChanges(
        { scheduledAt: new Date("2026-06-01T10:00:00Z") },
        { scheduledAt: new Date("2026-06-02T10:00:00Z") },
        ["scheduledAt"]
      );
      assert.ok(result.scheduledAt);
    });

    it("treats a missing field as null on both sides, using deep equality for objects/arrays", () => {
      const result = auditLogService.computeChanges({}, {}, ["tags"]);
      assert.equal(result, null);
    });

    it("detects a change in a nested object/array field via deep (not reference) comparison", () => {
      const result = auditLogService.computeChanges({ tags: ["a", "b"] }, { tags: ["a", "b", "c"] }, ["tags"]);
      assert.deepEqual(result.tags, { old: ["a", "b"], new: ["a", "b", "c"] });
    });

    it("does NOT flag two structurally-identical-but-different-instance arrays as changed", () => {
      const result = auditLogService.computeChanges({ tags: ["a", "b"] }, { tags: ["a", "b"] }, ["tags"]);
      assert.equal(result, null);
    });
  });

  describe("recordAuditLog - never throws, even when the write itself fails", () => {
    it("swallows a repository failure instead of propagating it - the real action it describes must not be broken by a logging failure", async (t) => {
      t.mock.method(auditLogRepo, "createAuditLog", async () => {
        throw new Error("DB write failed");
      });

      // should NOT throw
      await auditLogService.recordAuditLog({ actor: { id: "u1" }, action: "PRODUCT_UPDATED" });
    });

    it("pulls ip/userAgent/requestId from req when given, over explicit params", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });

      const fakeReq = { ip: "1.2.3.4", headers: { "user-agent": "TestAgent/1.0" }, requestId: "req-123" };

      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "USER_LOGIN",
        req: fakeReq,
        ip: "should-be-ignored",
        userAgent: "should-be-ignored",
        requestId: "should-be-ignored",
      });

      assert.equal(captured.ip, "1.2.3.4");
      assert.equal(captured.userAgent, "TestAgent/1.0");
      assert.equal(captured.requestId, "req-123");
    });

    it("falls back to explicit ip/userAgent/requestId when no req is given", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });

      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "USER_LOGIN",
        ip: "5.6.7.8",
        userAgent: "DirectAgent/1.0",
        requestId: "req-456",
      });

      assert.equal(captured.ip, "5.6.7.8");
      assert.equal(captured.userAgent, "DirectAgent/1.0");
      assert.equal(captured.requestId, "req-456");
    });

    it("defaults success to true and errorMessage to null when not specified", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });

      await auditLogService.recordAuditLog({ actor: { id: "u1" }, action: "PRODUCT_UPDATED" });

      assert.equal(captured.success, true);
      assert.equal(captured.errorMessage, null);
    });

    it("records success:false with an errorMessage when the underlying action failed", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });

      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "PRODUCT_DELETE",
        success: false,
        errorMessage: "Proizvod je referenciran u aktivnoj porudžbini",
      });

      assert.equal(captured.success, false);
      assert.equal(captured.errorMessage, "Proizvod je referenciran u aktivnoj porudžbini");
    });

    it("nulls out actor fields cleanly for an unauthenticated/system-triggered action", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });

      await auditLogService.recordAuditLog({ actor: null, action: "GRACE_PERIOD_SWEEP" });

      assert.deepEqual(captured.actor, { id: null, email: null, role: null });
    });
  });

  describe("thin listing wrappers", () => {
    it("listAuditLogs forwards filters/pagination straight to the repository", async (t) => {
      let capturedArgs;
      t.mock.method(auditLogRepo, "findAuditLogs", async (args) => {
        capturedArgs = args;
        return { data: [], total: 0, page: 1, limit: 25, totalPages: 0 };
      });

      await auditLogService.listAuditLogs({ filters: { action: "USER_LOGIN" }, limit: 10, page: 2 });

      assert.equal(capturedArgs.filters.action, "USER_LOGIN");
      assert.equal(capturedArgs.limit, 10);
      assert.equal(capturedArgs.page, 2);
    });

    it("getAuditLogById forwards straight to the repository", async (t) => {
      t.mock.method(auditLogRepo, "findAuditLogById", async () => ({ _id: "log1" }));
      const result = await auditLogService.getAuditLogById("log1");
      assert.equal(result._id, "log1");
    });

    it("listDistinctActions forwards straight to the repository", async (t) => {
      t.mock.method(auditLogRepo, "findDistinctActions", async () => ["USER_LOGIN", "PRODUCT_UPDATED"]);
      const result = await auditLogService.listDistinctActions();
      assert.deepEqual(result, ["USER_LOGIN", "PRODUCT_UPDATED"]);
    });
  });
});