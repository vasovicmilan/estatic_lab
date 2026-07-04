import { describe, it } from "node:test";
import assert from "node:assert/strict";
import employeeRepo from "../../../../src/repositories/employee.repository.js";
import appointmentRepo from "../../../../src/repositories/appointment.repository.js";
import serviceService from "../../../../src/services/service.service.js";
import * as availabilityService from "../../../../src/services/availability.service.js";
import { buildEmployee, buildServicePackageVariant, id } from "../../helpers/factories.js";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// always a future date (never rejected as "in the past"), with its real weekday name
// computed at test-run time so the fixture's workingHours always matches
function futureDateOnDay() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(0, 0, 0, 0);
  return { date, dayName: DAY_NAMES[date.getDay()] };
}

describe("availability.service", () => {
  describe("getAvailableSlots — input validation", () => {
    it("requires serviceId, servicePackageId, and date", async () => {
      await assert.rejects(() => availabilityService.getAvailableSlots({ servicePackageId: "x", date: new Date() }), (err) => err.statusCode === 400);
      await assert.rejects(() => availabilityService.getAvailableSlots({ serviceId: "x", date: new Date() }), (err) => err.statusCode === 400);
      await assert.rejects(() => availabilityService.getAvailableSlots({ serviceId: "x", servicePackageId: "y" }), (err) => err.statusCode === 400);
    });

    it("rejects a date in the past", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await assert.rejects(
        () => availabilityService.getAvailableSlots({ serviceId: "x", servicePackageId: "y", date: yesterday }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("getAvailableSlots — single employee slot math", () => {
    it("returns evenly-stepped slots covering the full working window when nothing is booked", async (t) => {
      const { date, dayName } = futureDateOnDay();
      const variant = buildServicePackageVariant({ duration: 60 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));

      const employee = buildEmployee({ workingHours: [{ day: dayName, slots: [{ from: "09:00", to: "12:00" }] }] });
      t.mock.method(employeeRepo, "findEmployeeById", async () => employee);
      t.mock.method(appointmentRepo, "findBusyIntervals", async () => []);

      const slots = await availabilityService.getAvailableSlots({
        serviceId: id().toString(),
        servicePackageId: id().toString(),
        employeeId: employee._id.toString(),
        date,
      });

      // 09:00-12:00 in 60-minute steps -> 09:00, 10:00, 11:00 (12:00 itself doesn't fit another full hour)
      assert.equal(slots.length, 3);
      assert.equal(slots[0].startTime.getHours(), 9);
      assert.equal(slots[2].startTime.getHours(), 11);
    });

    it("removes exactly the busy interval from the middle of the day", async (t) => {
      const { date, dayName } = futureDateOnDay();
      const variant = buildServicePackageVariant({ duration: 60 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));

      const employee = buildEmployee({ workingHours: [{ day: dayName, slots: [{ from: "09:00", to: "13:00" }] }] });
      t.mock.method(employeeRepo, "findEmployeeById", async () => employee);

      const busyStart = new Date(date);
      busyStart.setHours(10, 0, 0, 0);
      const busyEnd = new Date(date);
      busyEnd.setHours(11, 0, 0, 0);
      t.mock.method(appointmentRepo, "findBusyIntervals", async () => [{ startTime: busyStart, endTime: busyEnd }]);

      const slots = await availabilityService.getAvailableSlots({
        serviceId: id().toString(),
        servicePackageId: id().toString(),
        employeeId: employee._id.toString(),
        date,
      });

      const hours = slots.map((s) => s.startTime.getHours());
      assert.ok(!hours.includes(10), "10:00 should be blocked by the busy interval");
      assert.deepEqual(hours, [9, 11, 12]);
    });

    it("returns no slots on a day the employee doesn't work", async (t) => {
      const { date } = futureDateOnDay();
      const variant = buildServicePackageVariant({ duration: 60 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));

      const employee = buildEmployee({ workingHours: [] }); // no working hours at all
      t.mock.method(employeeRepo, "findEmployeeById", async () => employee);
      t.mock.method(appointmentRepo, "findBusyIntervals", async () => []);

      const slots = await availabilityService.getAvailableSlots({
        serviceId: id().toString(),
        servicePackageId: id().toString(),
        employeeId: employee._id.toString(),
        date,
      });

      assert.equal(slots.length, 0);
    });
  });

  describe("getAvailableSlots — multi-employee merge", () => {
    it("merges slots across employees, deduplicating identical start times", async (t) => {
      const { date, dayName } = futureDateOnDay();
      const variant = buildServicePackageVariant({ duration: 60 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));

      const employeeA = buildEmployee({ workingHours: [{ day: dayName, slots: [{ from: "09:00", to: "10:00" }] }] });
      const employeeB = buildEmployee({ workingHours: [{ day: dayName, slots: [{ from: "09:00", to: "10:00" }] }] });
      t.mock.method(employeeRepo, "findEmployeesByService", async () => [employeeA, employeeB]);
      t.mock.method(appointmentRepo, "findBusyIntervals", async () => []);

      const slots = await availabilityService.getAvailableSlots({
        serviceId: id().toString(),
        servicePackageId: id().toString(),
        date, // no employeeId -> merge mode
      });

      assert.equal(slots.length, 1, "both employees free at 09:00 should collapse into one slot entry");
      assert.equal(slots[0].employeeIds.length, 2);
    });

    it("returns an empty array when no employee can perform the service", async (t) => {
      const variant = buildServicePackageVariant({ duration: 60 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));
      t.mock.method(employeeRepo, "findEmployeesByService", async () => []);

      const { date } = futureDateOnDay();
      const slots = await availabilityService.getAvailableSlots({ serviceId: id().toString(), servicePackageId: id().toString(), date });

      assert.deepEqual(slots, []);
    });
  });

  describe("findFirstAvailableEmployee", () => {
    it("skips busy employees and returns the first free one", async (t) => {
      const busyEmployee = buildEmployee();
      const freeEmployee = buildEmployee();
      t.mock.method(employeeRepo, "findEmployeesByService", async () => [busyEmployee, freeEmployee]);
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async (employeeId) =>
        String(employeeId) === String(busyEmployee._id) ? [{ _id: id() }] : []
      );

      const result = await availabilityService.findFirstAvailableEmployee(id().toString(), new Date(), new Date());

      assert.equal(String(result._id), String(freeEmployee._id));
    });

    it("returns null when every candidate is busy", async (t) => {
      t.mock.method(employeeRepo, "findEmployeesByService", async () => [buildEmployee()]);
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => [{ _id: id() }]);

      const result = await availabilityService.findFirstAvailableEmployee(id().toString(), new Date(), new Date());

      assert.equal(result, null);
    });
  });
});