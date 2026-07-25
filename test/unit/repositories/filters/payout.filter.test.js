import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPayoutRequestFilter } from "../../../../src/repositories/filters/payout-request.filter.js";
import { id } from "../../../helpers/factories.js";

describe("payout-request.filter (buildPayoutRequestFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildPayoutRequestFilter(), {});
  });

  it("filters by earnerType", () => {
    assert.equal(buildPayoutRequestFilter({ earnerType: "partner" }).earnerType, "partner");
  });

  it("filters by employee", () => {
    const employeeId = id();
    assert.equal(buildPayoutRequestFilter({ employee: employeeId }).employee, employeeId);
  });

  it("filters by partner", () => {
    const partnerId = id();
    assert.equal(buildPayoutRequestFilter({ partner: partnerId }).partner, partnerId);
  });

  it("filters by a single status", () => {
    assert.equal(buildPayoutRequestFilter({ status: "paid" }).status, "paid");
  });

  it("statusIn takes precedence over (overwrites) a single status when both are given - the exact shape used to guard Employee/Partner deletion (requested+approved)", () => {
    const filter = buildPayoutRequestFilter({ status: "paid", statusIn: ["requested", "approved"] });
    assert.deepEqual(filter.status, { $in: ["requested", "approved"] });
  });

  it("combines multiple filters at once", () => {
    const partnerId = id();
    const filter = buildPayoutRequestFilter({ earnerType: "partner", partner: partnerId, statusIn: ["requested", "approved"] });
    assert.deepEqual(filter, {
      earnerType: "partner",
      partner: partnerId,
      status: { $in: ["requested", "approved"] },
    });
  });
});