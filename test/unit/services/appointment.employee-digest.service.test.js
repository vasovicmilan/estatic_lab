import { describe, it } from "node:test";
import assert from "node:assert/strict";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import * as appointmentService from "../../../src/services/appointment.service.js";
import { getStartOfDayInZone, nextDayStartInZone } from "../../../src/utils/date.time.util.js";
import { buildAppointment, buildEmployee, buildUser, buildService, id } from "../../helpers/factories.js";

/**
 * Unit coverage for appointment.service.js's employee-digest helpers
 * (findAppointmentsForEmployeeDigest / markEmployeeDigestSent) - the
 * service-level logic behind the two employee daily digest crons (see
 * jobs/employee-reminder-jobs.js). The repository itself is mocked out here
 * (see test/integration/repositories/appointment.repository.test.js for real
 * DB query coverage of findAppointmentsForEmployeeDigest/
 * markAppointmentsDigestSent) - this file is about the day-bounds computation
 * and the grouping-by-employee logic, both pure/service-level.
 */
describe("appointment.service - employee digest", () => {
  describe("findAppointmentsForEmployeeDigest", () => {
    it("computes Belgrade calendar-day bounds and passes them straight through to the repository", async (t) => {
      const findMock = t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async () => []);

      await appointmentService.findAppointmentsForEmployeeDigest(0, "employeeMorningReminderSentAt");

      assert.equal(findMock.mock.calls.length, 1);
      const [sentAtField, dayStart, dayEnd] = findMock.mock.calls[0].arguments;
      assert.equal(sentAtField, "employeeMorningReminderSentAt");

      const expectedStart = getStartOfDayInZone(new Date());
      const expectedEnd = nextDayStartInZone(expectedStart);
      assert.equal(dayStart.getTime(), expectedStart.getTime());
      assert.equal(dayEnd.getTime(), expectedEnd.getTime());
      // exactly 24h apart - a real calendar day, not some other span
      assert.equal(dayEnd.getTime() - dayStart.getTime(), 24 * 60 * 60 * 1000);
    });

    it("REGRESSION: dayOffset 1 (the evening/'sutra' run) resolves to tomorrow's calendar day, not today's", async (t) => {
      let capturedStart;
      t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async (sentAtField, dayStart) => {
        capturedStart = dayStart;
        return [];
      });

      await appointmentService.findAppointmentsForEmployeeDigest(1, "employeeEveningReminderSentAt");

      const todayStart = getStartOfDayInZone(new Date());
      const tomorrowStart = nextDayStartInZone(todayStart);
      assert.equal(capturedStart.getTime(), tomorrowStart.getTime());
    });

    it("groups appointments by employee (employee field), sorted by start time within each group", async (t) => {
      const employeeA = buildEmployee({ _id: id() });
      const employeeB = buildEmployee({ _id: id() });
      const service = buildService({ name: "Manikir" });

      const later = buildAppointment({
        employee: employeeA,
        assignedTo: null,
        service,
        startTime: new Date("2026-09-26T14:00:00.000Z"),
        contactSnapshot: { firstName: "Kasniji", lastName: "Klijent", email: "kasniji@example.com" },
      });
      const earlier = buildAppointment({
        employee: employeeA,
        assignedTo: null,
        service,
        startTime: new Date("2026-09-26T09:00:00.000Z"),
        contactSnapshot: { firstName: "Raniji", lastName: "Klijent", email: "raniji@example.com" },
      });
      const otherEmployeeAppointment = buildAppointment({
        employee: employeeB,
        assignedTo: null,
        service,
        startTime: new Date("2026-09-26T10:00:00.000Z"),
        contactSnapshot: { firstName: "Drugi", lastName: "Klijent", email: "drugi@example.com" },
      });

      t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async () => [later, earlier, otherEmployeeAppointment]);

      const groups = await appointmentService.findAppointmentsForEmployeeDigest(1, "employeeEveningReminderSentAt");

      assert.equal(groups.length, 2);

      const groupA = groups.find((g) => g.employee._id.toString() === employeeA._id.toString());
      assert.equal(groupA.appointments.length, 2);
      // earlier appointment must come first despite being pushed in second
      assert.equal(groupA.appointments[0].klijent, "Raniji Klijent");
      assert.equal(groupA.appointments[1].klijent, "Kasniji Klijent");
      // each appointment entry carries a display-ready time, not the raw sort key
      assert.ok(groupA.appointments[0].vreme);
      assert.equal(groupA.appointments[0].startTimeRaw, undefined);

      const groupB = groups.find((g) => g.employee._id.toString() === employeeB._id.toString());
      assert.equal(groupB.appointments.length, 1);
      assert.equal(groupB.appointments[0].klijent, "Drugi Klijent");
    });

    it("groups by assignedTo when `employee` isn't set (system/admin-assigned appointment)", async (t) => {
      const employee = buildEmployee({ _id: id() });
      const appointment = buildAppointment({
        employee: null,
        assignedTo: employee,
        contactSnapshot: { firstName: "Neko", lastName: "Klijent", email: "neko@example.com" },
      });
      t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async () => [appointment]);

      const groups = await appointmentService.findAppointmentsForEmployeeDigest(0, "employeeMorningReminderSentAt");

      assert.equal(groups.length, 1);
      assert.equal(groups[0].employee._id.toString(), employee._id.toString());
    });

    it("REGRESSION: silently drops an appointment with no employee AND no assignedTo, instead of crashing", async (t) => {
      const unassigned = buildAppointment({ employee: null, assignedTo: null });
      t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async () => [unassigned]);

      const groups = await appointmentService.findAppointmentsForEmployeeDigest(0, "employeeMorningReminderSentAt");

      assert.deepEqual(groups, []);
    });

    it("returns an empty array (not null/undefined) when there are no due appointments at all", async (t) => {
      t.mock.method(appointmentRepo, "findAppointmentsForEmployeeDigest", async () => []);

      const groups = await appointmentService.findAppointmentsForEmployeeDigest(0, "employeeMorningReminderSentAt");

      assert.deepEqual(groups, []);
    });
  });

  describe("markEmployeeDigestSent", () => {
    it("delegates straight to the repository's bulk updateMany-based helper with the given ids and field", async (t) => {
      const updateMock = t.mock.method(appointmentRepo, "markAppointmentsDigestSent", async () => ({ modifiedCount: 2 }));
      const ids = [id(), id()];

      const result = await appointmentService.markEmployeeDigestSent(ids, "employeeEveningReminderSentAt");

      assert.equal(updateMock.mock.calls.length, 1);
      assert.deepEqual(updateMock.mock.calls[0].arguments[0], ids);
      assert.equal(updateMock.mock.calls[0].arguments[1], "employeeEveningReminderSentAt");
      assert.deepEqual(result, { modifiedCount: 2 });
    });
  });
});
