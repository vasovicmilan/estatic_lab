import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import "../../../src/models/user.model.js";
import "../../../src/models/service.model.js";
import "../../../src/models/employee.model.js";

function validAppointment(overrides = {}) {
  const start = new Date("2026-08-10T10:00:00.000Z");
  return {
    user: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    variant: { name: "60 minuta", duration: 60, price: 3000 },
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com", phone: "0601234567" },
    ...overrides,
  };
}

describe("appointment.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createAppointment", () => {
    it("persists an appointment with the given fields", async () => {
      const appointment = await appointmentRepo.createAppointment(validAppointment());
      assert.ok(appointment._id);
      assert.equal(appointment.status, "pending");
      assert.equal(appointment.variant.name, "60 minuta");
    });

    // Note: `endTime` and `finalPrice` are `required: true` on the schema, and Mongoose
    // runs field validation BEFORE the pre('save') hook that derives them - so that hook
    // can never fill in a *missing* endTime at creation time, only recompute it on an
    // already-valid document being re-saved. Callers must always pass both explicitly at
    // creation (which appointment.service.js's bookAppointment already does).
    it("recomputes endTime via the pre-save hook when startTime changes on an existing document", async () => {
      const start = new Date("2026-09-01T09:00:00.000Z");
      const appointment = await appointmentRepo.createAppointment(
        validAppointment({
          startTime: start,
          endTime: new Date(start.getTime() + 60 * 60000),
          variant: { name: "60 minuta", duration: 60, price: 3000 },
        })
      );

      const newStart = new Date("2026-09-01T14:00:00.000Z");
      appointment.startTime = newStart;
      await appointment.save();

      assert.equal(appointment.endTime.getTime(), newStart.getTime() + 60 * 60000);
    });

    // packagePurchase/finalPrice interaction added alongside the package-consumption
    // feature - a package-covered booking is always finalPrice: 0, regardless of
    // whatever discountApplied/variant.price would otherwise compute to.
    it("stores the packagePurchase reference", async () => {
      const packagePurchaseId = new mongoose.Types.ObjectId();
      const appointment = await appointmentRepo.createAppointment(
        validAppointment({ packagePurchase: packagePurchaseId, finalPrice: 0 })
      );

      assert.equal(String(appointment.packagePurchase), String(packagePurchaseId));
    });

    it("defaults packagePurchase to null when not paid via a package", async () => {
      const appointment = await appointmentRepo.createAppointment(validAppointment());
      assert.equal(appointment.packagePurchase, null);
    });

    it("forces finalPrice to 0 via the pre-save hook once packagePurchase is set, even with a nonzero variant price", async () => {
      const created = await appointmentRepo.createAppointment(
        validAppointment({ variant: { name: "60 minuta", duration: 60, price: 3000 }, finalPrice: 3000 })
      );
      assert.equal(created.finalPrice, 3000, "sanity check: without a packagePurchase, finalPrice is untouched");

      created.packagePurchase = new mongoose.Types.ObjectId();
      await created.save();

      assert.equal(created.finalPrice, 0);
    });
  });

  describe("findAppointmentById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await appointmentRepo.findAppointmentById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findAppointments", () => {
    it("filters by userId", async () => {
      const userA = new mongoose.Types.ObjectId();
      const userB = new mongoose.Types.ObjectId();
      await appointmentRepo.createAppointment(validAppointment({ user: userA }));
      await appointmentRepo.createAppointment(validAppointment({ user: userB }));

      const result = await appointmentRepo.findAppointments({ filters: { userId: userA }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(String(result.data[0].user), String(userA));
    });

    it("filters by employeeId, matching either the direct employee or the assignedTo therapist", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await appointmentRepo.createAppointment(validAppointment({ employee: employeeId }));
      await appointmentRepo.createAppointment(validAppointment({ assignedTo: employeeId }));
      await appointmentRepo.createAppointment(validAppointment({}));

      const result = await appointmentRepo.findAppointments({ filters: { employeeId } });

      assert.equal(result.data.length, 2);
    });

    it("filters by status", async () => {
      await appointmentRepo.createAppointment(validAppointment({ status: "pending" }));
      await appointmentRepo.createAppointment(validAppointment({ status: "confirmed" }));

      const result = await appointmentRepo.findAppointments({ filters: { status: "confirmed" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].status, "confirmed");
    });

    it("searches by contact snapshot fields", async () => {
      await appointmentRepo.createAppointment(
        validAppointment({ contactSnapshot: { firstName: "Jovana", lastName: "Jovanovic", email: "jovana@example.com", phone: "" } })
      );
      await appointmentRepo.createAppointment(
        validAppointment({ contactSnapshot: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", phone: "" } })
      );

      const result = await appointmentRepo.findAppointments({ search: "Jovana" });

      assert.equal(result.data.length, 1);
    });

    it("finds unassigned pending appointments only", async () => {
      await appointmentRepo.createAppointment(validAppointment({ status: "pending", employee: null, assignedTo: null }));
      await appointmentRepo.createAppointment(validAppointment({ status: "pending", employee: new mongoose.Types.ObjectId() }));

      const result = await appointmentRepo.findAppointments({ filters: { unassignedOnly: true } });

      assert.equal(result.data.length, 1);
    });
  });

  describe("findBusyIntervals", () => {
    it("only counts pending/confirmed appointments as busy", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const rangeStart = new Date("2026-08-10T00:00:00.000Z");
      const rangeEnd = new Date("2026-08-11T00:00:00.000Z");

      await appointmentRepo.createAppointment(validAppointment({ employee: employeeId, status: "confirmed" }));
      await appointmentRepo.createAppointment(validAppointment({ employee: employeeId, status: "cancelled" }));

      const busy = await appointmentRepo.findBusyIntervals(employeeId, rangeStart, rangeEnd);

      assert.equal(busy.length, 1, "a cancelled appointment should not block the slot");
    });

    it("only returns intervals overlapping the requested range", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await appointmentRepo.createAppointment(validAppointment({ employee: employeeId, status: "pending" }));

      const outsideRange = await appointmentRepo.findBusyIntervals(
        employeeId,
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-02T00:00:00.000Z")
      );

      assert.equal(outsideRange.length, 0);
    });

    it("matches intervals whether the employee is the direct employee or the assignedTo therapist", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const rangeStart = new Date("2026-08-10T00:00:00.000Z");
      const rangeEnd = new Date("2026-08-11T00:00:00.000Z");

      await appointmentRepo.createAppointment(validAppointment({ assignedTo: employeeId, status: "confirmed" }));

      const busy = await appointmentRepo.findBusyIntervals(employeeId, rangeStart, rangeEnd);

      assert.equal(busy.length, 1);
    });
  });

  describe("findOverlappingAppointments", () => {
    it("returns an empty array when no employeeId is given", async () => {
      const result = await appointmentRepo.findOverlappingAppointments(null, new Date(), new Date());
      assert.deepEqual(result, []);
    });

    it("excludes the given appointment id (used when reassigning the same appointment)", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const start = new Date("2026-08-10T10:00:00.000Z");
      const end = new Date("2026-08-10T11:00:00.000Z");
      const appointment = await appointmentRepo.createAppointment(
        validAppointment({ employee: employeeId, startTime: start, endTime: end, status: "confirmed" })
      );

      const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, start, end, appointment._id);

      assert.equal(overlapping.length, 0, "the appointment being checked against itself shouldn't count as a conflict");
    });

    it("detects a genuine overlap with a different appointment", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const start = new Date("2026-08-10T10:00:00.000Z");
      const end = new Date("2026-08-10T11:00:00.000Z");
      await appointmentRepo.createAppointment(validAppointment({ employee: employeeId, startTime: start, endTime: end, status: "confirmed" }));

      const overlapping = await appointmentRepo.findOverlappingAppointments(employeeId, start, end);

      assert.equal(overlapping.length, 1);
    });
  });

  describe("updateAppointmentById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await appointmentRepo.createAppointment(validAppointment());
      const updated = await appointmentRepo.updateAppointmentById(created._id, { status: "confirmed" });
      assert.equal(updated.status, "confirmed");
    });
  });

  describe("deleteAppointmentById", () => {
    it("deletes the appointment", async () => {
      const created = await appointmentRepo.createAppointment(validAppointment());
      await appointmentRepo.deleteAppointmentById(created._id);
      const found = await appointmentRepo.findAppointmentById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countAppointments", () => {
    it("counts appointments matching a status filter", async () => {
      await appointmentRepo.createAppointment(validAppointment({ status: "pending" }));
      await appointmentRepo.createAppointment(validAppointment({ status: "confirmed" }));

      const count = await appointmentRepo.countAppointments({ status: "pending" });

      assert.equal(count, 1);
    });
  });
});