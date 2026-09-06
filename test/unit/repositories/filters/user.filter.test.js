import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUserFilter } from "../../../../src/repositories/filters/user.filter.js";
import { id } from "../../../helpers/factories.js";

describe("user.filter (buildUserFilter)", () => {
  it("excludes anonymized ('deleted') accounts by default when no status is given", () => {
    assert.deepEqual(buildUserFilter().status, { $ne: "deleted" });
  });

  it("filters by an explicit non-deleted status, dropping the default exclusion", () => {
    assert.equal(buildUserFilter({ status: "active" }).status, "active");
    assert.equal(buildUserFilter({ status: "suspended" }).status, "suspended");
  });

  it("refuses to filter for status:'deleted' directly - falls back to excluding it, same as no filter at all", () => {
    // Anonymized accounts have nothing left worth listing (see user.service.js's
    // anonymizeUser) - this holds even if some future caller passes "deleted"
    // explicitly, whether by a stale bookmark, a copy-pasted query string, or a
    // deliberate attempt to bypass the admin listing exclusion.
    assert.deepEqual(buildUserFilter({ status: "deleted" }).status, { $ne: "deleted" });
  });

  it("search matches first name, last name, or email, case-insensitively", () => {
    const filter = buildUserFilter({ search: "Petrovic" });
    assert.deepEqual(filter.$or, [
      { firstName: { $regex: "Petrovic", $options: "i" } },
      { lastName: { $regex: "Petrovic", $options: "i" } },
      { email: { $regex: "Petrovic", $options: "i" } },
    ]);
  });

  it("filters by role", () => {
    const roleId = id();
    assert.equal(buildUserFilter({ role: roleId }).role, roleId);
  });

  it("filters by provider", () => {
    assert.equal(buildUserFilter({ provider: "google" }).provider, "google");
  });

  it("excludes a given user id via excludeId", () => {
    const userId = id();
    assert.deepEqual(buildUserFilter({ excludeId: userId })._id, { $ne: userId });
  });

  it("combines search, role, provider, excludeId, and the default deleted-exclusion all at once", () => {
    const roleId = id();
    const excludeId = id();
    const filter = buildUserFilter({ search: "ana", role: roleId, provider: "local", excludeId });
    assert.deepEqual(filter.status, { $ne: "deleted" });
    assert.equal(filter.role, roleId);
    assert.equal(filter.provider, "local");
    assert.deepEqual(filter._id, { $ne: excludeId });
    assert.ok(Array.isArray(filter.$or));
  });
});
