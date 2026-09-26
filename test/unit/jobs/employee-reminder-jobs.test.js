import { describe, it } from "node:test";
import assert from "node:assert/strict";
import appointmentService from "../../../src/services/appointment.service.js";
import emailService from "../../../src/services/email.service.js";
import { runEmployeeEveningDigest, runEmployeeMorningDigest } from "../../../src/jobs/employee-reminder-jobs.js";
import { id } from "../../helpers/factories.js";

// Mirrors test/integration/jobs/appointment-reminder-jobs.test.js's coverage
// style, but at the unit level (appointmentService/emailService fully mocked,
// no DB) since this job's grouping/query logic is already covered by
// test/unit/services/appointment.employee-digest.service.test.js - this file
// is about the job's own orchestration: which employees get emailed, which
// appointments get marked sent, and that one failure never blocks the batch.
function group(employee, appointments) {
  return { employee, appointments };
}

function appt(overrides = {}) {
  return { id: id().toString(), klijent: "Test Klijent", usluga: "Test Usluga", vreme: "10:00", ...overrides };
}

describe("employee-reminder-jobs", () => {
  describe("runEmployeeEveningDigest", () => {
    it("asks the service for tomorrow's (dayOffset 1) digest, keyed by the evening sentAt field", async (t) => {
      const digestMock = t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => []);

      await runEmployeeEveningDigest();

      assert.equal(digestMock.mock.calls.length, 1);
      assert.deepEqual(digestMock.mock.calls[0].arguments, [1, "employeeEveningReminderSentAt"]);
    });

    it("sends the 'sutra'-framed digest email to an active employee with an email, then bulk-marks their appointments sent", async (t) => {
      const employee = { _id: id(), isActive: true, userId: { firstName: "Ana", email: "ana@example.com" } };
      const appointments = [appt({ id: "a1" }), appt({ id: "a2" })];
      t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => [group(employee, appointments)]);
      const emailMock = t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async () => {});
      const markMock = t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

      await runEmployeeEveningDigest();

      assert.equal(emailMock.mock.calls.length, 1);
      const [recipient, sentAppointments, options] = emailMock.mock.calls[0].arguments;
      assert.deepEqual(recipient, { email: "ana@example.com", firstName: "Ana" });
      assert.deepEqual(sentAppointments, appointments);
      assert.deepEqual(options, { when: "sutra" });

      assert.equal(markMock.mock.calls.length, 1);
      assert.deepEqual(markMock.mock.calls[0].arguments, [["a1", "a2"], "employeeEveningReminderSentAt"]);
    });
  });

  describe("runEmployeeMorningDigest", () => {
    it("asks the service for today's (dayOffset 0) digest, keyed by the morning sentAt field, framed as 'danas'", async (t) => {
      const employee = { _id: id(), isActive: true, userId: { firstName: "Ivan", email: "ivan@example.com" } };
      const appointments = [appt({ id: "a3" })];
      const digestMock = t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => [group(employee, appointments)]);
      const emailMock = t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async () => {});
      t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

      await runEmployeeMorningDigest();

      assert.deepEqual(digestMock.mock.calls[0].arguments, [0, "employeeMorningReminderSentAt"]);
      assert.deepEqual(emailMock.mock.calls[0].arguments[2], { when: "danas" });
    });
  });

  it("skips an inactive employee entirely - no email sent, their appointments never marked", async (t) => {
    const inactiveEmployee = { _id: id(), isActive: false, userId: { firstName: "Neaktivan", email: "neaktivan@example.com" } };
    t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => [group(inactiveEmployee, [appt()])]);
    const emailMock = t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async () => {});
    const markMock = t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

    await runEmployeeMorningDigest();

    assert.equal(emailMock.mock.calls.length, 0);
    assert.equal(markMock.mock.calls.length, 0);
  });

  it("skips an employee with no populated userId.email - no email sent, no crash", async (t) => {
    const noEmailEmployee = { _id: id(), isActive: true, userId: { firstName: "Bez Emaila" } };
    t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => [group(noEmailEmployee, [appt()])]);
    const emailMock = t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async () => {});
    t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

    await assert.doesNotReject(() => runEmployeeMorningDigest());
    assert.equal(emailMock.mock.calls.length, 0);
  });

  it("REGRESSION: one employee's send failure doesn't block the rest of the batch, and only the successful ones get marked sent", async (t) => {
    const failing = { _id: id(), isActive: true, userId: { firstName: "Prvi", email: "prvi@example.com" } };
    const succeeding = { _id: id(), isActive: true, userId: { firstName: "Drugi", email: "drugi@example.com" } };
    const failingAppts = [appt({ id: "fail-1" })];
    const succeedingAppts = [appt({ id: "ok-1" }), appt({ id: "ok-2" })];

    t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => [
      group(failing, failingAppts),
      group(succeeding, succeedingAppts),
    ]);
    t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async ({ email }) => {
      if (email === "prvi@example.com") throw new Error("SMTP down");
    });
    const markMock = t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

    await assert.doesNotReject(() => runEmployeeMorningDigest());

    assert.equal(markMock.mock.calls.length, 1);
    assert.deepEqual(markMock.mock.calls[0].arguments[0], ["ok-1", "ok-2"]);
  });

  it("does nothing (and doesn't throw, doesn't call markEmployeeDigestSent) when no employee has any appointments today", async (t) => {
    t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => []);
    const emailMock = t.mock.method(emailService, "sendEmployeeDailyDigestEmail", async () => {});
    const markMock = t.mock.method(appointmentService, "markEmployeeDigestSent", async () => {});

    await assert.doesNotReject(() => runEmployeeMorningDigest());

    assert.equal(emailMock.mock.calls.length, 0);
    assert.equal(markMock.mock.calls.length, 0);
  });

  it("REGRESSION: a top-level failure (e.g. the digest query itself throwing) is caught and never thrown out of the job (runJob wrapper)", async (t) => {
    t.mock.method(appointmentService, "findAppointmentsForEmployeeDigest", async () => {
      throw new Error("DB unreachable");
    });

    await assert.doesNotReject(() => runEmployeeMorningDigest());
  });
});
