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
});
