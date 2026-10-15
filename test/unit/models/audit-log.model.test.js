import { describe, it } from "node:test";
import assert from "node:assert/strict";
import AuditLog from "../../../src/models/audit-log.model.js";

describe("audit-log.model", () => {
  it("declares a TTL index on `timestamp` for 2-year (730 day) retention", () => {
    const indexes = AuditLog.schema.indexes();
    const ttlIndex = indexes.find(([, options]) => options && typeof options.expireAfterSeconds === "number");

    assert.ok(ttlIndex, "expected a TTL index (expireAfterSeconds) to be declared");
    const [fields, options] = ttlIndex;
    assert.deepEqual(fields, { timestamp: 1 });
    assert.equal(options.expireAfterSeconds, 730 * 24 * 60 * 60);
  });

  it("still keeps the entity/actor lookup indexes alongside the TTL one", () => {
    const indexes = AuditLog.schema.indexes();
    const hasEntityIndex = indexes.some(([fields]) => fields["entity.type"] === 1 && fields["entity.id"] === 1 && fields.timestamp === -1);
    const hasActorIndex = indexes.some(([fields]) => fields["actor.id"] === 1 && fields.timestamp === -1);

    assert.ok(hasEntityIndex, "expected the entity.type+entity.id+timestamp compound index");
    assert.ok(hasActorIndex, "expected the actor.id+timestamp compound index");
  });

  // These run the REAL schema (validateSync, no DB) - the repository-mocking service tests
  // can't see a cast failure, which is how "singleton" entries were silently lost.
  describe("entity.id", () => {
    const base = { timestamp: new Date(), actor: { id: null, email: "a@b.c", role: "admin" }, action: "SITE_SETTINGS_UPDATED", success: true };

    it("accepts the string id used for singleton records (SiteSettings / SiteContent)", () => {
      const doc = new AuditLog({ ...base, entity: { type: "SiteSettings", id: "singleton" } });
      assert.equal(doc.validateSync(), undefined);
      assert.equal(doc.entity.id, "singleton");
    });

    it("accepts a real ObjectId and a null id", () => {
      const withId = new AuditLog({ ...base, entity: { type: "Product", id: "6ad11f919b5a514f904f6c18" } });
      assert.equal(withId.validateSync(), undefined);
      const withoutId = new AuditLog({ ...base, entity: { type: "Route", id: null } });
      assert.equal(withoutId.validateSync(), undefined);
    });
  });
});
