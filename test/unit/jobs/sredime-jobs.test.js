import { describe, it } from "node:test";
import assert from "node:assert/strict";
import employeeService from "../../../src/services/employee.service.js";
import externalBusyIntervalService from "../../../src/services/external-busy-interval.service.js";
import auditLogService from "../../../src/services/audit-log.service.js";
import { runSredimeSync } from "../../../src/jobs/sredime-jobs.js";

function buildEmployee(overrides = {}) {
  return { _id: { toString: () => "emp1" }, sredimeIcsUrl: "https://sredime.example.com/feed.ics", ...overrides };
}

describe("sredime-jobs", () => {
  it("does nothing when no employee has a SrediMe URL configured", async (t) => {
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => []);
    const syncMock = t.mock.method(externalBusyIntervalService, "syncEmployeeFromIcs", async () => ({ synced: 0, removed: 0 }));

    await runSredimeSync();

    assert.equal(syncMock.mock.calls.length, 0);
  });

  it("syncs every employee with a configured URL", async (t) => {
    const employees = [buildEmployee({ _id: { toString: () => "emp1" } }), buildEmployee({ _id: { toString: () => "emp2" } })];
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => employees);
    const syncMock = t.mock.method(externalBusyIntervalService, "syncEmployeeFromIcs", async () => ({ synced: 2, removed: 1 }));

    await runSredimeSync();

    assert.equal(syncMock.mock.calls.length, 2);
  });

  it("records one EMPLOYEE_SREDIME_CALENDAR_SYNCED audit entry per employee, with a system actor", async (t) => {
    const employees = [buildEmployee({ _id: { toString: () => "emp1" } }), buildEmployee({ _id: { toString: () => "emp2" } })];
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => employees);
    t.mock.method(externalBusyIntervalService, "syncEmployeeFromIcs", async () => ({ synced: 2, removed: 1 }));
    const auditMock = t.mock.method(auditLogService, "recordAuditLog", async () => {});

    await runSredimeSync();

    assert.equal(auditMock.mock.calls.length, 2);
    const call = auditMock.mock.calls[0].arguments[0];
    assert.equal(call.action, "EMPLOYEE_SREDIME_CALENDAR_SYNCED");
    assert.equal(call.actor.role, "system");
    assert.equal(call.entity.type, "Employee");
    assert.deepEqual(call.changes, { synced: { old: null, new: 2 }, removed: { old: null, new: 1 } });
  });

  it("does not record an audit entry for an employee whose sync found nothing to change", async (t) => {
    const employees = [buildEmployee()];
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => employees);
    t.mock.method(externalBusyIntervalService, "syncEmployeeFromIcs", async () => ({ synced: 0, removed: 0 }));
    const auditMock = t.mock.method(auditLogService, "recordAuditLog", async () => {});

    await runSredimeSync();

    assert.equal(auditMock.mock.calls.length, 0);
  });

  it("REGRESSION: one employee's feed failing (bad URL, SrediMe hiccup) doesn't block the rest of the batch", async (t) => {
    const employees = [buildEmployee({ _id: { toString: () => "broken" } }), buildEmployee({ _id: { toString: () => "fine" } })];
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => employees);

    const syncMock = t.mock.method(externalBusyIntervalService, "syncEmployeeFromIcs", async (employee) => {
      if (employee._id.toString() === "broken") throw new Error("ICS feed unreachable");
      return { synced: 1, removed: 0 };
    });

    await assert.doesNotReject(() => runSredimeSync());

    assert.equal(syncMock.mock.calls.length, 2);
  });

  it("never throws even if the employee lookup itself fails", async (t) => {
    t.mock.method(employeeService, "getEmployeesWithSredimeIcsUrl", async () => {
      throw new Error("DB unreachable");
    });

    await assert.doesNotReject(() => runSredimeSync());
  });
});
