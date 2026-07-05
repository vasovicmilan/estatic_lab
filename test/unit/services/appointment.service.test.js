import { describe, it } from "node:test";
import assert from "node:assert/strict";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import * as appointmentService from "../../../src/services/appointment.service.js";
import { buildAppointment, buildEmployee, buildUser, id } from "../../helpers/factories.js";

describe("appointment.service", () => {
  describe("getAppointmentById — access control", () => {
    it("throws 404 when the appointment doesn't exist", async (t) => {
      t.mock.method(appointmentRepo, "findAppointmentById", async () => null);
      await assert.rejects(() => appointmentService.getAppointmentById("missing", id(), "user"), (err) => err.statusCode === 404);
    });

    it("lets the owning user see their own appointment", async (t) => {
      const owner = buildUser();
      const appointment = buildAppointment({ user: owner });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await appointmentService.getAppointmentById(appointment._id.toString(), owner._id.toString(), "user");
    });

    it("forbids a different user from viewing someone else's appointment", async (t) => {
      const appointment = buildAppointment({ user: buildUser() });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await assert.rejects(
        () => appointmentService.getAppointmentById(appointment._id.toString(), id().toString(), "user"),
        (err) => err.statusCode === 403
      );
    });

    it("lets the assigned employee view it, even if they weren't the explicitly chosen one", async (t) => {
      const employeeUser = buildEmployee();
      const appointment = buildAppointment({ employee: null, assignedTo: employeeUser });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await appointmentService.getAppointmentById(appointment._id.toString(), employeeUser._id.toString(), "employee");
    });

    it("forbids an unrelated employee from viewing it", async (t) => {
      const appointment = buildAppointment({ employee: buildEmployee(), assignedTo: null });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await assert.rejects(
        () => appointmentService.getAppointmentById(appointment._id.toString(), id().toString(), "employee"),
        (err) => err.statusCode === 403
      );
    });

    it("always lets admin through regardless of ownership", async (t) => {
      const appointment = buildAppointment({ user: buildUser() });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await appointmentService.getAppointmentById(appointment._id.toString(), id().toString(), "admin");
    });
  });

  describe("status transitions", () => {
    it("confirmAppointment moves a pending appointment to confirmed for admin", async (t) => {
      let current = buildAppointment({ status: "pending" });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => current);
      t.mock.method(appointmentRepo, "updateAppointmentById", async (appId, patch) => {
        current = { ...current, ...patch };
        return current;
      });

      const result = await appointmentService.confirmAppointment(current._id.toString(), id().toString(), "admin");

      assert.equal(result.status, "Potvrđeno");
    });

    it("refuses to confirm an already-completed appointment (no such transition exists)", async (t) => {
      const appointment = buildAppointment({ status: "completed" });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await assert.rejects(
        () => appointmentService.confirmAppointment(appointment._id.toString(), id().toString(), "admin"),
        (err) => err.statusCode === 400
      );
    });

    it("a plain 'user' cannot confirm an appointment (only admin/employee can)", async (t) => {
      const owner = buildUser();
      const appointment = buildAppointment({ status: "pending", user: owner });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await assert.rejects(
        () => appointmentService.confirmAppointment(appointment._id.toString(), owner._id.toString(), "user"),
        (err) => err.statusCode === 400
      );
    });

    it("rejectAppointment records the reason and actor", async (t) => {
      const employeeUser = buildEmployee();
      const appointment = buildAppointment({ status: "pending", employee: employeeUser, assignedTo: null });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      let updatePayload;
      t.mock.method(appointmentRepo, "updateAppointmentById", async (appId, patch) => {
        updatePayload = patch;
        return { ...appointment, ...patch };
      });

      await appointmentService.rejectAppointment(appointment._id.toString(), "Nema termina", employeeUser._id.toString(), "employee");

      assert.equal(updatePayload.status, "rejected");
      assert.equal(updatePayload.rejectedBy, "employee");
      assert.equal(updatePayload.rejectionReason, "Nema termina");
    });
  });

  describe("cancelAppointment — the 24h rule", () => {
    it("blocks a user from cancelling less than 24h before the appointment", async (t) => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now
      const owner = buildUser();
      const appointment = buildAppointment({ status: "confirmed", user: owner, startTime: soon });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);

      await assert.rejects(
        () => appointmentService.cancelAppointment(appointment._id.toString(), "predomislio sam se", owner._id.toString(), "user"),
        (err) => err.statusCode === 400
      );
    });

    it("allows a user to cancel with more than 24h notice", async (t) => {
      const farEnough = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const owner = buildUser();
      const appointment = buildAppointment({ status: "confirmed", user: owner, startTime: farEnough });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "cancelled" }));

      await appointmentService.cancelAppointment(appointment._id.toString(), "predomislio sam se", owner._id.toString(), "user");
    });

    it("the 24h rule does NOT apply to admin cancellations", async (t) => {
      const soon = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const appointment = buildAppointment({ status: "confirmed", startTime: soon });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "cancelled" }));

      await appointmentService.cancelAppointment(appointment._id.toString(), "razlog admina", id().toString(), "admin");
    });
  });

  describe("reassignAppointment", () => {
    it("refuses to reassign to an employee who's busy at that time", async (t) => {
      const appointment = buildAppointment();
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => [buildAppointment()]);

      await assert.rejects(
        () => appointmentService.reassignAppointment(appointment._id.toString(), id().toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("reassigns successfully when the new employee is free", async (t) => {
      const appointment = buildAppointment();
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
      let updatePayload;
      t.mock.method(appointmentRepo, "updateAppointmentById", async (appId, patch) => {
        updatePayload = patch;
        return { ...appointment, ...patch };
      });

      await appointmentService.reassignAppointment(appointment._id.toString(), id().toString(), id().toString());

      assert.equal(updatePayload.assignedBy, "admin");
      assert.equal(updatePayload.assignedTo, null);
    });
  });
});