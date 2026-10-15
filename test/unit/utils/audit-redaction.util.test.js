import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactChanges, redactDeep, isSensitiveField, isRedactionExempt, REDACTED } from "../../../src/utils/audit-redaction.util.js";

describe("audit-redaction.util", () => {
  it("recognizes sensitive field names case-insensitively", () => {
    for (const name of ["telefon", "Phone", "adresa", "EMAIL", "firstName", "imePrezime", "napomena", "password", "token"]) {
      assert.equal(isSensitiveField(name), true, name);
    }
    for (const name of ["status", "price", "name", "isActive", "roleId"]) {
      assert.equal(isSensitiveField(name), false, name);
    }
  });

  it("hides both sides of a sensitive field but keeps whether it was set, changed or cleared", () => {
    assert.deepEqual(redactChanges({ telefon: { old: "1", new: "2" } }), { telefon: { old: REDACTED, new: REDACTED } });
    assert.deepEqual(redactChanges({ telefon: { old: null, new: "2" } }), { telefon: { old: null, new: REDACTED } });
    assert.deepEqual(redactChanges({ telefon: { old: "1", new: null } }), { telefon: { old: REDACTED, new: null } });
    assert.deepEqual(redactChanges({ telefon: { old: "", new: "" } }), { telefon: { old: null, new: null } });
  });

  it("leaves non-personal fields alone", () => {
    assert.deepEqual(redactChanges({ status: { old: "a", new: "b" }, price: { old: 1, new: 2 } }), { status: { old: "a", new: "b" }, price: { old: 1, new: 2 } });
  });

  it("finds sensitive keys nested inside an otherwise harmless field", () => {
    const out = redactChanges({ contact: { old: { email: "a@b.c", city: "Novi Sad" }, new: { email: "x@y.z", city: "Beograd" } } });
    assert.deepEqual(out.contact, { old: { email: REDACTED, city: "Novi Sad" }, new: { email: REDACTED, city: "Beograd" } });
  });

  it("redactDeep walks arrays and ignores dates and primitives", () => {
    const date = new Date("2026-01-01");
    assert.deepEqual(redactDeep([{ phone: "1" }, { x: date }]), [{ phone: REDACTED }, { x: date }]);
    assert.equal(redactDeep("text"), "text");
    assert.equal(redactDeep(null), null);
  });

  it("passes null/undefined changes through", () => {
    assert.equal(redactChanges(null), null);
    assert.equal(redactChanges(undefined), null);
  });

  it("exempts the records that describe the business itself", () => {
    assert.equal(isRedactionExempt("SiteSettings"), true);
    assert.equal(isRedactionExempt("SiteContent"), true);
    assert.equal(isRedactionExempt("Order"), false);
    assert.equal(isRedactionExempt(undefined), false);
  });
});
