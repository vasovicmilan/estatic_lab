import { describe, it } from "node:test";
import assert from "node:assert/strict";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import commissionEntryRepo from "../../../src/repositories/commission-entry.repository.js";
import payoutRequestRepo from "../../../src/repositories/payout-request.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import roleService from "../../../src/services/role.service.js";
import * as employeeService from "../../../src/services/employee.service.js";
import { buildEmployee, buildRole, id } from "../../helpers/factories.js";

describe("employee.service", () => {
  describe("working hours validation (exercised via createEmployee)", () => {
    it("rejects an unknown weekday", async () => {
      await assert.rejects(
        () => employeeService.createEmployee({ userId: id(), workingHours: [{ day: "funday", slots: [] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a malformed time string", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      await assert.rejects(
        () => employeeService.createEmployee({ userId: id(), workingHours: [{ day: "monday", slots: [{ from: "9am", to: "17:00" }] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a slot where 'from' is not before 'to'", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      await assert.rejects(
        () => employeeService.createEmployee({ userId: id(), workingHours: [{ day: "monday", slots: [{ from: "17:00", to: "09:00" }] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects overlapping slots on the same day", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      await assert.rejects(
        () =>
          employeeService.createEmployee({
            userId: id(),
            workingHours: [
              {
                day: "monday",
                slots: [
                  { from: "09:00", to: "13:00" },
                  { from: "12:00", to: "17:00" }, // overlaps the first slot
                ],
              },
            ],
          }),
        (err) => err.statusCode === 400
      );
    });

    it("accepts a valid split shift (non-overlapping slots)", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      const employeeRole = buildRole({ name: "employee", priority: 50 });
      t.mock.method(roleService, "findRoleByName", async () => employeeRole);
      const created = buildEmployee();
      t.mock.method(employeeRepo, "createEmployee", async () => created);
      t.mock.method(userRepo, "findUserById", async () => ({ role: { priority: 0, name: "user" } }));
      t.mock.method(userRepo, "updateUserById", async () => {});
      t.mock.method(employeeRepo, "findEmployeeById", async () => created);

      // should NOT throw
      await employeeService.createEmployee({
        userId: id(),
        workingHours: [
          {
            day: "monday",
            slots: [
              { from: "09:00", to: "13:00" },
              { from: "14:00", to: "18:00" },
            ],
          },
        ],
      });
    });
  });

  describe("createEmployee", () => {
    it("rejects a user who already has an employee profile", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => buildEmployee());
      await assert.rejects(() => employeeService.createEmployee({ userId: id() }), (err) => err.statusCode === 409);
    });

    it("throws if the 'employee' role isn't configured", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      t.mock.method(roleService, "findRoleByName", async () => null);
      await assert.rejects(() => employeeService.createEmployee({ userId: id() }), (err) => err.statusCode === 400);
    });

    it("promotes the target user's role to 'employee' on success", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      const employeeRole = buildRole({ name: "employee", priority: 50 });
      t.mock.method(roleService, "findRoleByName", async () => employeeRole);
      const created = buildEmployee();
      t.mock.method(employeeRepo, "createEmployee", async () => created);
      t.mock.method(userRepo, "findUserById", async () => ({ role: { priority: 0, name: "user" } }));
      let updatedRolePayload;
      t.mock.method(userRepo, "updateUserById", async (userId, patch) => {
        updatedRolePayload = patch;
      });
      t.mock.method(employeeRepo, "findEmployeeById", async () => created);

      await employeeService.createEmployee({ userId: id() });

      assert.deepEqual(updatedRolePayload.role, employeeRole._id);
    });
  });

  describe("updateEmployeeById", () => {
    it("converts an empty-string expert (unselected <select>) to null instead of passing it to Mongoose", async (t) => {
      let capturedUpdate;
      t.mock.method(employeeRepo, "updateEmployeeById", async (id, data) => {
        capturedUpdate = data;
        return buildEmployee();
      });
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());

      await employeeService.updateEmployeeById(id().toString(), { expert: "", services: [] });

      assert.equal(capturedUpdate.expert, null, "empty string must be sanitized to null, not passed through as-is");
    });

    it("filters out falsy entries from services without dropping valid ids", async (t) => {
      let capturedUpdate;
      t.mock.method(employeeRepo, "updateEmployeeById", async (id, data) => {
        capturedUpdate = data;
        return buildEmployee();
      });
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());

      const validId = id().toString();
      await employeeService.updateEmployeeById(id().toString(), { services: [validId, ""] });

      assert.deepEqual(capturedUpdate.services, [validId]);
    });

    it("throws 404 when the employee doesn't exist", async (t) => {
      t.mock.method(employeeRepo, "updateEmployeeById", async () => null);
      await assert.rejects(() => employeeService.updateEmployeeById(id().toString(), {}), (err) => err.statusCode === 404);
    });
  });

  describe("manageWorkingHours", () => {
    it("forbids a non-admin employee from editing someone else's working hours", async (t) => {
      const targetEmployee = buildEmployee({ userId: id() });
      t.mock.method(employeeRepo, "findEmployeeById", async () => targetEmployee);

      await assert.rejects(
        () => employeeService.manageWorkingHours(targetEmployee._id.toString(), [], id().toString(), "employee"),
        (err) => err.statusCode === 403
      );
    });

    it("allows an employee to edit their own working hours", async (t) => {
      const ownerId = id();
      const targetEmployee = buildEmployee({ userId: ownerId });
      t.mock.method(employeeRepo, "findEmployeeById", async () => targetEmployee);
      t.mock.method(employeeRepo, "updateEmployeeById", async () => targetEmployee);

      await employeeService.manageWorkingHours(targetEmployee._id.toString(), [], ownerId.toString(), "employee");
    });

    it("allows an admin to edit any employee's working hours", async (t) => {
      const targetEmployee = buildEmployee({ userId: id() });
      t.mock.method(employeeRepo, "findEmployeeById", async () => targetEmployee);
      t.mock.method(employeeRepo, "updateEmployeeById", async () => targetEmployee);

      await employeeService.manageWorkingHours(targetEmployee._id.toString(), [], id().toString(), "admin");
    });
  });

  describe("deleteEmployeeById", () => {
    it("throws 404 for a nonexistent employee", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeById", async () => null);
      await assert.rejects(() => employeeService.deleteEmployeeById("missing"), (err) => err.statusCode === 404);
    });

    function mockNoReferences(t) {
      t.mock.method(appointmentRepo, "countAppointments", async () => 0);
      t.mock.method(commissionEntryRepo, "countCommissionEntries", async () => 0);
      t.mock.method(payoutRequestRepo, "countPayoutRequests", async () => 0);
    }

    it("deletes an employee with no remaining references at all", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());
      t.mock.method(employeeRepo, "deleteEmployeeById", async () => true);
      mockNoReferences(t);

      const result = await employeeService.deleteEmployeeById(id().toString());
      assert.equal(result.success, true);
    });

    it("refuses to delete an employee with any appointment, even a terminal (completed) one", async (t) => {
      // Unlike Service, Employee has no name snapshot on Appointment - so this blocks
      // regardless of status, not just pending/confirmed.
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());
      mockNoReferences(t);
      t.mock.method(appointmentRepo, "countAppointments", async () => 1);

      await assert.rejects(() => employeeService.deleteEmployeeById(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to delete an employee with commission history", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());
      mockNoReferences(t);
      t.mock.method(commissionEntryRepo, "countCommissionEntries", async () => 1);

      await assert.rejects(() => employeeService.deleteEmployeeById(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to delete an employee with payout history", async (t) => {
      t.mock.method(employeeRepo, "findEmployeeById", async () => buildEmployee());
      mockNoReferences(t);
      t.mock.method(payoutRequestRepo, "countPayoutRequests", async () => 1);

      await assert.rejects(() => employeeService.deleteEmployeeById(id().toString()), (err) => err.statusCode === 400);
    });
  });
});