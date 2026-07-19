import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  translateStatus,
  mapAppointmentForAdminShort,
  mapAppointmentForAdminDetail,
  mapAppointmentForEmployeeDetail,
  mapAppointmentForUserDetail,
  mapAppointmentForPublicCalendar,
  mapAppointment,
} from "../../../src/mappers/appointment.mapper.js";
import { buildAppointment, buildUser, buildEmployee, id } from "../../helpers/factories.js";

describe("appointment.mapper", () => {
  describe("translateStatus", () => {
    it("translates every known status", () => {
      assert.equal(translateStatus("pending"), "Na čekanju");
      assert.equal(translateStatus("confirmed"), "Potvrđeno");
      assert.equal(translateStatus("rejected"), "Odbijeno");
      assert.equal(translateStatus("cancelled"), "Otkazano");
      assert.equal(translateStatus("completed"), "Završeno");
      assert.equal(translateStatus("no_show"), "Nije se pojavio/la");
    });
  });

  describe("contact resolution priority: contactSnapshot > populated user > 'Nepoznat korisnik'", () => {
    it("prefers the contactSnapshot (guest booking) over a linked user", () => {
      const appointment = buildAppointment({
        contactSnapshot: { firstName: "Gost", lastName: "Ime", email: "gost@example.com" },
        user: buildUser({ firstName: "Nalog", lastName: "Ime" }),
      });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.korisnik.ime, "Gost Ime");
    });

    it("falls back to the populated user when there's no contactSnapshot name", () => {
      const appointment = buildAppointment({ contactSnapshot: {}, user: buildUser({ firstName: "Ana", lastName: "Anic" }) });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.korisnik.ime, "Ana Anic");
    });

    it("falls back to 'Nepoznat korisnik' when neither exists", () => {
      const appointment = buildAppointment({ contactSnapshot: {}, user: id() });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.korisnik.ime, "Nepoznat korisnik");
    });

    it("phone falls back to decrypting the user's phone only when contactSnapshot has none", () => {
      const appointment = buildAppointment({ contactSnapshot: {}, user: buildUser({ phone: "0641234567" }) });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.korisnik.telefon, "0641234567");
    });
  });

  describe("employee/therapist name resolution", () => {
    it("resolves the populated employee's linked user name", () => {
      const employee = buildEmployee({ userId: buildUser({ firstName: "Marko", lastName: "Markovic" }) });
      const appointment = buildAppointment({ employee });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.terapeut, "Marko Markovic");
    });

    it("is null when no employee is assigned at all", () => {
      const appointment = buildAppointment({ employee: null });
      const mapped = mapAppointmentForAdminDetail(appointment);
      assert.equal(mapped.terapeut, null);
    });

    it("mapAppointmentForUserDetail falls back to assignedTo when employee isn't set yet", () => {
      const assignedTo = buildEmployee({ userId: buildUser({ firstName: "Jovana", lastName: "Jovanovic" }) });
      const appointment = buildAppointment({ employee: null, assignedTo });
      const mapped = mapAppointmentForUserDetail(appointment);
      assert.equal(mapped.terapeut, "Jovana Jovanovic");
    });

    it("shows 'Nije dodeljen' to the user when there's neither employee nor assignedTo", () => {
      const appointment = buildAppointment({ employee: null, assignedTo: null });
      const mapped = mapAppointmentForUserDetail(appointment);
      assert.equal(mapped.terapeut, "Nije dodeljen");
    });
  });

  describe("price formatting", () => {
    it("formats finalPrice with two decimals and RSD suffix", () => {
      const appointment = buildAppointment({ finalPrice: 2500 });
      assert.equal(mapAppointmentForAdminDetail(appointment).konacnaCena, "2500.00 RSD");
    });

    it("treats finalPrice: 0 as a real price (shows '0.00 RSD'), not as missing", () => {
      const appointment = buildAppointment({ finalPrice: 0 });
      assert.equal(mapAppointmentForAdminDetail(appointment).konacnaCena, "0.00 RSD");
    });

    it("shows null (not '0.00 RSD') when finalPrice is genuinely not set", () => {
      const appointment = buildAppointment({ finalPrice: undefined });
      assert.equal(mapAppointmentForAdminDetail(appointment).konacnaCena, null);
    });

    it("the admin LIST shape (unlike detail) shows '0 RSD' as its not-yet-priced fallback instead of null", () => {
      const appointment = buildAppointment({ finalPrice: undefined });
      assert.equal(mapAppointmentForAdminShort(appointment).konacnaCena, "0 RSD");
    });
  });

  describe("mapAppointmentForEmployeeDetail - mojaUloga (direct booking vs system-assigned)", () => {
    it("says 'Direktno zakazan' when employee and assignedTo are the same", () => {
      const employeeId = id();
      const appointment = buildAppointment({ employee: { _id: employeeId }, assignedTo: { _id: employeeId } });
      const mapped = mapAppointmentForEmployeeDetail(appointment);
      assert.equal(mapped.mojaUloga, "Direktno zakazan");
    });

    it("says 'Dodeljen od strane sistema' when they differ", () => {
      const appointment = buildAppointment({ employee: { _id: id() }, assignedTo: { _id: id() } });
      const mapped = mapAppointmentForEmployeeDetail(appointment);
      assert.equal(mapped.mojaUloga, "Dodeljen od strane sistema");
    });
  });

  describe("conditional rejection/cancellation reason (user detail)", () => {
    it("only shows razlogOdbijanja when status is actually 'rejected'", () => {
      const rejected = mapAppointmentForUserDetail(buildAppointment({ status: "rejected", rejectionReason: "Terapeut nedostupan" }));
      assert.equal(rejected.razlogOdbijanja, "Terapeut nedostupan");

      const confirmed = mapAppointmentForUserDetail(buildAppointment({ status: "confirmed", rejectionReason: "leftover value" }));
      assert.equal(confirmed.razlogOdbijanja, null, "a leftover rejectionReason shouldn't leak through for a non-rejected appointment");
    });

    it("defaults to 'Nije naveden' for a rejected appointment with no reason text", () => {
      const mapped = mapAppointmentForUserDetail(buildAppointment({ status: "rejected", rejectionReason: null }));
      assert.equal(mapped.razlogOdbijanja, "Nije naveden");
    });
  });

  describe("mapAppointmentForPublicCalendar - no personal data", () => {
    it("only exposes start/end time and the therapist id, nothing else", () => {
      const appointment = buildAppointment({ contactSnapshot: { firstName: "Secret" } });
      const mapped = mapAppointmentForPublicCalendar(appointment);
      assert.deepEqual(Object.keys(mapped).sort(), ["kraj", "pocetak", "terapeutId"]);
    });

    it("returns null for a null appointment", () => {
      assert.equal(mapAppointmentForPublicCalendar(null), null);
    });
  });

  describe("mapAppointment dispatcher", () => {
    it("routes to the admin shape for role=admin", () => {
      const mapped = mapAppointment(buildAppointment(), "admin", "detail");
      assert.ok("terapeutId" in mapped);
    });

    it("routes to the employee shape for role=employee", () => {
      const mapped = mapAppointment(buildAppointment(), "employee", "detail");
      assert.ok("mojaUloga" in mapped);
    });

    it("routes to the user shape for any other role (including guest)", () => {
      const mapped = mapAppointment(buildAppointment(), "guest", "detail");
      assert.ok("razlogOdbijanja" in mapped);
      assert.ok(!("terapeutId" in mapped), "the user-facing shape doesn't expose the raw employee id");
    });

    it("returns null for a null appointment", () => {
      assert.equal(mapAppointment(null, "admin", "detail"), null);
    });
  });
});