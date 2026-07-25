import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { mapPayoutRequestForAdminDetail, translateStatus } from "../../../src/mappers/payout-request.mapper.js";

function baseRequest(overrides = {}) {
  return {
    _id: new Types.ObjectId(),
    earnerType: "employee",
    amount: 5000,
    status: "requested",
    requestedAt: new Date(),
    ...overrides,
  };
}

describe("payout-request.mapper", () => {
  describe("translateStatus", () => {
    it("translates every known status", () => {
      assert.equal(translateStatus("requested"), "Zatraženo");
      assert.equal(translateStatus("approved"), "Odobreno");
      assert.equal(translateStatus("paid"), "Isplaćeno");
      assert.equal(translateStatus("rejected"), "Odbijeno");
    });
  });

  describe("earner name resolution", () => {
    it("resolves a populated employee's linked user name", () => {
      const request = baseRequest({
        employee: { userId: { firstName: "Marko", lastName: "Markovic" } },
      });
      assert.equal(mapPayoutRequestForAdminDetail(request).earnerName, "Marko Markovic");
    });

    it("falls back to employeeSnapshot.name when the Employee was deleted (populate resolves to null)", () => {
      const request = baseRequest({ employee: null, employeeSnapshot: { name: "Bivši Zaposleni" } });
      assert.equal(mapPayoutRequestForAdminDetail(request).earnerName, "Bivši Zaposleni");
    });

    it("prefers employeeSnapshot.name over a live populate when both are present", () => {
      const request = baseRequest({
        employee: { userId: { firstName: "Marko", lastName: "Markovic" } },
        employeeSnapshot: { name: "Neko Drugi" },
      });
      assert.equal(mapPayoutRequestForAdminDetail(request).earnerName, "Neko Drugi");
    });

    it("shows Nepoznato for an employee earner with no snapshot and no populated data", () => {
      const request = baseRequest({ employee: null });
      assert.equal(mapPayoutRequestForAdminDetail(request).earnerName, "Nepoznato");
    });

    it("resolves a populated partner's linked user name, independent of employeeSnapshot", () => {
      const request = baseRequest({
        earnerType: "partner",
        partner: { userId: { firstName: "Petar", lastName: "Petrovic" } },
      });
      assert.equal(mapPayoutRequestForAdminDetail(request).earnerName, "Petar Petrovic");
    });
  });

  describe("mapPayoutRequestForAdminDetail", () => {
    it("returns null for a null request", () => {
      assert.equal(mapPayoutRequestForAdminDetail(null), null);
    });

    it("formats amount with an RSD suffix", () => {
      const request = baseRequest({ amount: 12500 });
      assert.equal(mapPayoutRequestForAdminDetail(request).iznos, "12500 RSD");
    });
  });
});