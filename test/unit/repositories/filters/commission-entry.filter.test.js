import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCommissionEntryFilter } from "../../../../src/repositories/filters/commission-entry.filter.js";
import { id } from "../../../helpers/factories.js";

describe("commission-entry.filter (buildCommissionEntryFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildCommissionEntryFilter(), {});
  });

  it("filters by earnerType", () => {
    assert.equal(buildCommissionEntryFilter({ earnerType: "employee" }).earnerType, "employee");
  });

  it("filters by employee", () => {
    const employeeId = id();
    assert.equal(buildCommissionEntryFilter({ employee: employeeId }).employee, employeeId);
  });

  it("filters by partner", () => {
    const partnerId = id();
    assert.equal(buildCommissionEntryFilter({ partner: partnerId }).partner, partnerId);
  });

  it("filters by a single status", () => {
    assert.equal(buildCommissionEntryFilter({ status: "pending" }).status, "pending");
  });

  it("statusIn takes precedence over (overwrites) a single status when both are given", () => {
    const filter = buildCommissionEntryFilter({ status: "earned", statusIn: ["pending", "reversed"] });
    assert.deepEqual(filter.status, { $in: ["pending", "reversed"] });
  });

  it("filters by sourceType", () => {
    assert.equal(buildCommissionEntryFilter({ sourceType: "appointment" }).sourceType, "appointment");
  });

  it("combines multiple filters at once - the exact shape used to guard Employee/Partner deletion", () => {
    const employeeId = id();
    const filter = buildCommissionEntryFilter({ employee: employeeId, status: "pending" });
    assert.deepEqual(filter, { employee: employeeId, status: "pending" });
  });
});