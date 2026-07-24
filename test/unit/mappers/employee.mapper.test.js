import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapEmployeeForAdminDetail } from "../../../src/mappers/employee.mapper.js";
import { buildEmployee, id } from "../../helpers/factories.js";

describe("employee.mapper", () => {
  describe("getServiceNames (exercised via mapEmployeeForAdminDetail's usluge field)", () => {
    it("shows every service's name when all are populated", () => {
      const employee = buildEmployee({ services: [{ name: "Masaza" }, { name: "Piling" }] });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.deepEqual(mapped.usluge, ["Masaza", "Piling"]);
    });

    it("shows a placeholder instead of silently dropping a service whose ref resolved to null (genuinely deleted)", () => {
      const employee = buildEmployee({ services: [{ name: "Masaza" }, null] });
      const mapped = mapEmployeeForAdminDetail(employee);
      // Previously this would have silently dropped the null entry, making the
      // usluge list one shorter than employee.services.length (which brojUsluga
      // is based on) with no indication anything was wrong.
      assert.equal(mapped.usluge.length, 2);
      assert.equal(mapped.usluge[0], "Masaza");
      assert.equal(mapped.usluge[1], "Usluga obrisana");
    });

    it("shows a distinct placeholder for a raw (unpopulated) ObjectId vs. a genuinely deleted one", () => {
      const rawId = id();
      const employee = buildEmployee({ services: [rawId] });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.usluge[0], "Usluga nije učitana");
    });
  });
});