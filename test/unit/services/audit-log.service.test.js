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

  describe("normalizeEntityId", () => {
    it("turns a 24-hex id string into an ObjectId so it keeps matching older entries", () => {
      const out = auditLogService.normalizeEntityId("6ad11f919b5a514f904f6c18");
      assert.equal(typeof out, "object");
      assert.equal(String(out), "6ad11f919b5a514f904f6c18");
    });

    it("keeps non-ObjectId ids such as 'singleton' as plain strings and maps empty values to null", () => {
      assert.equal(auditLogService.normalizeEntityId("singleton"), "singleton");
      assert.equal(auditLogService.normalizeEntityId(null), null);
      assert.equal(auditLogService.normalizeEntityId(undefined), null);
      assert.equal(auditLogService.normalizeEntityId(""), null);
    });
  });

  describe("normalizeChanges", () => {
    it("leaves { old, new } pairs untouched", () => {
      assert.deepEqual(auditLogService.normalizeChanges({ status: { old: "a", new: "b" } }), { status: { old: "a", new: "b" } });
    });

    it("rewrites { before, after } and { after } into { old, new }", () => {
      assert.deepEqual(auditLogService.normalizeChanges({ workingHours: { before: [1], after: [2] }, whyUs: { after: { x: 1 } } }), {
        workingHours: { old: [1], new: [2] },
        whyUs: { old: null, new: { x: 1 } },
      });
    });

    it("returns null for no changes", () => {
      assert.equal(auditLogService.normalizeChanges(null), null);
      assert.equal(auditLogService.normalizeChanges({}), null);
    });
  });

  describe("recordAuditLog - entity ids and change shapes reach the repository normalized", () => {
    it("passes the singleton id through as a string and unifies the changes shape", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });
      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "SITE_SETTINGS_WORKING_HOURS_UPDATED",
        entity: { type: "SiteSettings", id: "singleton" },
        changes: { workingHours: { before: [1], after: [2] } },
      });
      assert.equal(captured.entity.id, "singleton");
      assert.deepEqual(captured.changes, { workingHours: { old: [1], new: [2] } });
    });
  });

  describe("computeProfileChanges", () => {
    it("compares name and phone, so the caller learns which of them changed", () => {
      const result = auditLogService.computeProfileChanges(
        { firstName: "Ana", lastName: "Ilić", telefon: "+381601111111" },
        { firstName: "Ana", lastName: "Petrović", telefon: "+381602222222" }
      );
      assert.deepEqual(Object.keys(result).sort(), ["lastName", "telefon"]);
    });

    it("returns null when nothing changed", () => {
      const same = { firstName: "Ana", lastName: "Ilić", telefon: "+381601111111" };
      assert.equal(auditLogService.computeProfileChanges(same, { ...same }), null);
    });
  });

  describe("recordAuditLog - personal data is redacted before it is written", () => {
    it("hides phone, address and names but keeps non-personal fields as they are", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });
      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "ORDER_CONTACT_INFO_UPDATED",
        entity: { type: "Order", id: "6ad11f919b5a514f904f6c18" },
        changes: {
          telefon: { old: "+381601111111", new: "+381602222222" },
          adresa: { old: { city: "Novi Sad", street: "Bulevar 1" }, new: { city: "Beograd", street: "Knez 2" } },
          lastName: { old: "Ilić", new: "Petrović" },
          status: { old: "pending", new: "shipped" },
        },
      });
      const text = JSON.stringify(captured.changes);
      assert.ok(!text.includes("+3816"), "phone number leaked into the audit entry");
      assert.ok(!text.includes("Bulevar") && !text.includes("Knez"), "street leaked into the audit entry");
      assert.ok(!text.includes("Ilić") && !text.includes("Petrović"), "name leaked into the audit entry");
      assert.deepEqual(captured.changes.telefon, { old: "[sakriveno]", new: "[sakriveno]" });
      assert.deepEqual(captured.changes.status, { old: "pending", new: "shipped" });
    });

    it("keeps the direction of a change: a cleared value is [sakriveno] -> null", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });
      await auditLogService.recordAuditLog({ actor: { id: "u1" }, action: "EXPERT_DELETED", entity: { type: "Expert", id: "6ad11f919b5a514f904f6c18" }, changes: { imePrezime: { old: "Ana Ilić", new: null } } });
      assert.deepEqual(captured.changes.imePrezime, { old: "[sakriveno]", new: null });
    });

    it("does not redact the salon's own contact data in site settings", async (t) => {
      let captured;
      t.mock.method(auditLogRepo, "createAuditLog", async (data) => {
        captured = data;
      });
      await auditLogService.recordAuditLog({
        actor: { id: "u1" },
        action: "SITE_SETTINGS_UPDATED",
        entity: { type: "SiteSettings", id: "singleton" },
        changes: { email: { old: "a@salon.rs", new: "b@salon.rs" } },
      });
      assert.deepEqual(captured.changes.email, { old: "a@salon.rs", new: "b@salon.rs" });
    });
  });

  describe("scrubActorEmail", () => {
    it("delegates to the repository and swallows a failure", async (t) => {
      const calls = [];
      t.mock.method(auditLogRepo, "scrubActorEmail", async (id) => {
        calls.push(id);
      });
      await auditLogService.scrubActorEmail("u1");
      assert.deepEqual(calls, ["u1"]);

      t.mock.method(auditLogRepo, "scrubActorEmail", async () => {
        throw new Error("db down");
      });
      await auditLogService.scrubActorEmail("u1"); // must not throw
    });
  });
});
