import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import Appointment from "../../../src/models/appointment.model.js";
import emailService from "../../../src/services/email.service.js";
import { runAppointmentReminders } from "../../../src/jobs/appointment-reminder-jobs.js";
import "../../../src/models/user.model.js";
import "../../../src/models/service.model.js";
import "../../../src/models/employee.model.js";

function inHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function baseAppointment(overrides = {}) {
  const start = inHours(20); // inside the 24h window by default
  return {
    user: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "confirmed",
    contactSnapshot: {
      firstName: "Marko",
      lastName: "Markovic",
      email: "marko@example.com",
      phone: { hash: "test-hash", encrypted: "test-encrypted" },
    },
    reminder24hSentAt: null,
    reminder4hSentAt: null,
    ...overrides,
  };
}

/**
 * Integration coverage for src/jobs/appointment-reminder-jobs.js - previously
 * had zero test coverage of any kind. Caught a real production bug while
 * writing this: findAppointmentsDueForReminder was mapping with the "user"
 * role, which never includes a korisnik field, so appointment.korisnik?.email
 * was always undefined and every single reminder silently skipped its
 * `if (!email) continue` guard - fixed in appointment.service.js (now uses
 * "admin" role, which does include korisnik.ime/korisnik.email).
 */
describe("appointment-reminder-jobs", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  it("sends a 24h reminder for a confirmed appointment due in the window, and marks it sent in the DB", async (t) => {
    const appointment = await Appointment.create(baseAppointment());
    const emailMock = t.mock.method(emailService, "sendAppointmentReminderEmail", async () => {});

    await runAppointmentReminders();

    assert.equal(emailMock.mock.calls.length, 1);
    const [{ email, firstName }, mappedAppointment, hoursBefore] = emailMock.mock.calls[0].arguments;
    assert.equal(email, "marko@example.com");
    // korisnik.ime is the mapper's combined "firstName lastName" (see
    // appointment.mapper.js's getUserName) - not just the bare first name,
    // despite the job's own local variable being named `firstName`
    assert.equal(firstName, "Marko Markovic");
    assert.equal(mappedAppointment.id, appointment._id.toString());
    assert.equal(hoursBefore, 24);

    const updated = await Appointment.findById(appointment._id);
    assert.ok(updated.reminder24hSentAt instanceof Date);
  });

  it("also sends the independent 4h reminder for an appointment in that window", async (t) => {
    const appointment = await Appointment.create(baseAppointment({ startTime: inHours(3), endTime: inHours(3.5) }));
    const emailMock = t.mock.method(emailService, "sendAppointmentReminderEmail", async () => {});

    await runAppointmentReminders();

    assert.equal(emailMock.mock.calls.length, 2);
    // numeric sort - plain .sort() is lexicographic ("24" < "4" as strings)
    const hoursBeforeValues = emailMock.mock.calls.map((c) => c.arguments[2]).sort((a, b) => a - b);
    assert.deepEqual(hoursBeforeValues, [4, 24]);

    const updated = await Appointment.findById(appointment._id);
    assert.ok(updated.reminder24hSentAt instanceof Date);
    assert.ok(updated.reminder4hSentAt instanceof Date);
  });

  it("never emails a pending (unconfirmed) appointment, even if it's inside the window", async (t) => {
    await Appointment.create(baseAppointment({ status: "pending" }));
    const emailMock = t.mock.method(emailService, "sendAppointmentReminderEmail", async () => {});

    await runAppointmentReminders();

    assert.equal(emailMock.mock.calls.length, 0);
  });

  it("never sends the same reminder twice - the sentAt guard field actually persists across runs", async (t) => {
    await Appointment.create(baseAppointment({ reminder24hSentAt: new Date() }));
    const emailMock = t.mock.method(emailService, "sendAppointmentReminderEmail", async () => {});

    await runAppointmentReminders();

    const hoursBeforeValues = emailMock.mock.calls.map((c) => c.arguments[2]);
    assert.equal(hoursBeforeValues.includes(24), false);
  });

  it("REGRESSION: one appointment's email failure doesn't block the rest of the batch", async (t) => {
    const failing = await Appointment.create(
      baseAppointment({ contactSnapshot: { firstName: "Prva", lastName: "Osoba", email: "prva@example.com", phone: { hash: "h", encrypted: "e" } } })
    );
    const succeeding = await Appointment.create(
      baseAppointment({ contactSnapshot: { firstName: "Druga", lastName: "Osoba", email: "druga@example.com", phone: { hash: "h", encrypted: "e" } } })
    );

    t.mock.method(emailService, "sendAppointmentReminderEmail", async ({ email }) => {
      if (email === "prva@example.com") throw new Error("SMTP down");
    });

    await assert.doesNotReject(() => runAppointmentReminders());

    const updatedFailing = await Appointment.findById(failing._id);
    const updatedSucceeding = await Appointment.findById(succeeding._id);
    assert.equal(updatedFailing.reminder24hSentAt, null);
    assert.ok(updatedSucceeding.reminder24hSentAt instanceof Date);
  });

  it("skips an appointment with no contact email at all, without crashing the batch", async (t) => {
    await Appointment.create(baseAppointment({ contactSnapshot: { firstName: "Bez Emaila" } }));
    await Appointment.create(baseAppointment());
    const emailMock = t.mock.method(emailService, "sendAppointmentReminderEmail", async () => {});

    await assert.doesNotReject(() => runAppointmentReminders());

    assert.equal(emailMock.mock.calls.length, 1);
    assert.equal(emailMock.mock.calls[0].arguments[0].email, "marko@example.com");
  });

  it("does nothing (and doesn't throw) when there are no due appointments at all", async () => {
    await assert.doesNotReject(() => runAppointmentReminders());
  });
});
