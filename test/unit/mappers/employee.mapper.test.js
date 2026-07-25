import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapEmployeeForAdminShort,
  mapEmployeesForAdminList,
  mapEmployeeForAdminDetail,
  mapEmployeeForEdit,
  mapEmployeeForEmployeeShort,
  mapEmployeeForEmployeeDetail,
  mapEmployeeForPublic,
  mapEmployeeRaw,
  mapEmployee,
} from "../../../src/mappers/employee.mapper.js";
import { buildEmployee, buildUser, id } from "../../helpers/factories.js";

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

  describe("getFullName/getEmail/getPhone - fallback when userId isn't a populated object", () => {
    it("resolves name/email/phone from a populated userId", () => {
      const employee = buildEmployee({ userId: buildUser({ firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: "0641234567" }) });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.korisnik.imePrezime, "Marko Markovic");
      assert.equal(mapped.korisnik.email, "marko@example.com");
      assert.equal(mapped.korisnik.telefon, "0641234567");
    });

    it("falls back to 'Nepoznato'/null/null when userId is a raw (unpopulated) id", () => {
      const employee = buildEmployee({ userId: id() });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.korisnik.imePrezime, "Nepoznato");
      assert.equal(mapped.korisnik.email, null);
      assert.equal(mapped.korisnik.telefon, null);
    });

    it("shows 'Nepoznato' rather than a stray leading/trailing space when only one of firstName/lastName is set", () => {
      const employee = buildEmployee({ userId: buildUser({ firstName: "", lastName: "" }) });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.korisnik.imePrezime, "Nepoznato");
    });
  });

  describe("getLinkedExpert", () => {
    it("returns null when no expert is linked", () => {
      const mapped = mapEmployeeForAdminDetail(buildEmployee({ expert: null }));
      assert.equal(mapped.povezaniEkspert, null);
    });

    it("resolves a populated expert's name/slug", () => {
      const expertId = id();
      const employee = buildEmployee({ expert: { _id: expertId, firstName: "Jovana", lastName: "Jovanovic", slug: "jovana-jovanovic" } });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.povezaniEkspert.id, expertId.toString());
      assert.equal(mapped.povezaniEkspert.imePrezime, "Jovana Jovanovic");
      assert.equal(mapped.povezaniEkspert.slug, "jovana-jovanovic");
    });

    it("falls back to just the raw id when expert isn't populated", () => {
      const expertId = id();
      const mapped = mapEmployeeForAdminDetail(buildEmployee({ expert: expertId }));
      assert.equal(mapped.povezaniEkspert.id, expertId.toString());
      assert.equal("imePrezime" in mapped.povezaniEkspert, false);
    });
  });

  describe("mapEmployeeForAdminShort / mapEmployeesForAdminList", () => {
    it("translates isActive to Da/Ne and counts services from the raw array length", () => {
      const employee = buildEmployee({ isActive: false, services: [id(), id(), id()] });
      const mapped = mapEmployeeForAdminShort(employee);
      assert.equal(mapped.aktivan, "Ne");
      assert.equal(mapped.brojUsluga, 3);
    });

    it("defaults brojUsluga to 0 when services is missing entirely", () => {
      const employee = buildEmployee();
      delete employee.services;
      assert.equal(mapEmployeeForAdminShort(employee).brojUsluga, 0);
    });

    it("mapEmployeesForAdminList maps a whole array", () => {
      const list = mapEmployeesForAdminList([buildEmployee(), buildEmployee()]);
      assert.equal(list.length, 2);
    });
  });

  describe("mapEmployeeForEdit - raw shape for the admin form", () => {
    it("returns null for a null employee", () => {
      assert.equal(mapEmployeeForEdit(null), null);
    });

    it("flattens userId/expert/services to plain id strings regardless of population", () => {
      const userId = id();
      const expertId = id();
      const serviceId = id();
      const employee = buildEmployee({
        userId: { _id: userId, firstName: "Marko", lastName: "Markovic" },
        expert: { _id: expertId },
        services: [{ _id: serviceId }],
      });
      const mapped = mapEmployeeForEdit(employee);
      assert.equal(mapped.userId, userId.toString());
      assert.equal(mapped.expert, expertId.toString());
      assert.equal(mapped.services[0], serviceId.toString());
    });

    it("expert defaults to null when unset", () => {
      const mapped = mapEmployeeForEdit(buildEmployee({ expert: null }));
      assert.equal(mapped.expert, null);
    });

    it("payType defaults to 'salary' when unset", () => {
      const employee = buildEmployee();
      delete employee.payType;
      assert.equal(mapEmployeeForEdit(employee).payType, "salary");
    });
  });

  describe("payType-dependent fields (commission vs salary)", () => {
    it("shows the commission rate when payType is commission", () => {
      const employee = buildEmployee({ payType: "commission", commissionRate: 25 });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.nacinIsplate, "Provizija");
      assert.equal(mapped.procenatProvizije, "25%");
    });

    it("hides the commission rate entirely when payType is salary", () => {
      const employee = buildEmployee({ payType: "salary" });
      const mapped = mapEmployeeForAdminDetail(employee);
      assert.equal(mapped.nacinIsplate, "Fiksna plata");
      assert.equal(mapped.procenatProvizije, null);
    });
  });

  describe("mapEmployeeForEmployeeShort / mapEmployeeForEmployeeDetail / mapEmployeeForPublic", () => {
    it("mapEmployeeForEmployeeShort includes brojUsluga and aktivan, not the full admin detail shape", () => {
      const employee = buildEmployee({ isActive: true, services: [id()] });
      const mapped = mapEmployeeForEmployeeShort(employee);
      assert.equal(mapped.aktivan, "Da");
      assert.equal(mapped.brojUsluga, 1);
      assert.ok(!("email" in mapped));
    });

    it("mapEmployeeForEmployeeDetail includes both formatted and raw working hours", () => {
      const employee = buildEmployee({ workingHours: [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }] });
      const mapped = mapEmployeeForEmployeeDetail(employee);
      assert.deepEqual(mapped.radnoVreme, [{ dan: "Ponedeljak", termini: ["09:00 - 17:00"] }]);
      assert.deepEqual(mapped.workingHoursRaw, [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }]);
    });

    it("mapEmployeeForPublic exposes only name/services/hours - no email/phone", () => {
      const employee = buildEmployee();
      const mapped = mapEmployeeForPublic(employee);
      assert.deepEqual(Object.keys(mapped).sort(), ["id", "imePrezime", "radnoVreme", "usluge"]);
    });
  });

  describe("mapEmployeeRaw", () => {
    it("returns the object unchanged", () => {
      const employee = buildEmployee();
      assert.equal(mapEmployeeRaw(employee), employee);
    });
  });

  describe("mapEmployee dispatcher", () => {
    it("returns null for a null employee regardless of role", () => {
      assert.equal(mapEmployee(null, "admin", "detail"), null);
    });

    it("routes admin+short to mapEmployeeForAdminShort", () => {
      const mapped = mapEmployee(buildEmployee(), "admin", "short");
      assert.ok("brojUsluga" in mapped && !("korisnik" in mapped));
    });

    it("routes admin+detail to mapEmployeeForAdminDetail", () => {
      const mapped = mapEmployee(buildEmployee(), "admin", "detail");
      assert.ok("korisnik" in mapped);
    });

    it("routes employee+short to mapEmployeeForEmployeeShort", () => {
      const mapped = mapEmployee(buildEmployee(), "employee", "short");
      assert.ok("brojUsluga" in mapped && !("radnoVreme" in mapped));
    });

    it("routes employee+detail to mapEmployeeForEmployeeDetail", () => {
      const mapped = mapEmployee(buildEmployee(), "employee", "detail");
      assert.ok("workingHoursRaw" in mapped);
    });

    it("falls through to the public shape for any other role (e.g. guest/user)", () => {
      const mapped = mapEmployee(buildEmployee(), "guest", "detail");
      assert.deepEqual(Object.keys(mapped).sort(), ["id", "imePrezime", "radnoVreme", "usluge"]);
    });
  });
});