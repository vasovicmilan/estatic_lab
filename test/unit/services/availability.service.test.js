import { describe, it } from "node:test";
import assert from "node:assert/strict";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import serviceService from "../../../src/services/service.service.js";
import * as availabilityService from "../../../src/services/availability.service.js";
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
  describe("getAvailableSlots - input validation", () => {
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

  describe("getAvailableSlots - single employee slot math", () => {
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

      // 09:00-12:00 on the 30-min grid, 60-min service -> 09:00, 09:30, 10:00,
      // 10:30, 11:00 (11:30 would end at 12:30, past the 12:00 close, so it's excluded)
      const slotTimes = slots.map((s) => `${s.startTime.getHours()}:${String(s.startTime.getMinutes()).padStart(2, "0")}`);
      assert.deepEqual(slotTimes, ["9:00", "9:30", "10:00", "10:30", "11:00"]);
    });

    it("offers grid-aligned start times independent of the service's own duration (e.g. a 45-min service still starts on :00/:30)", async (t) => {
      const { date, dayName } = futureDateOnDay();
      const variant = buildServicePackageVariant({ duration: 45 });
      t.mock.method(serviceService, "getActiveVariant", async () => ({ variant, service: {} }));

      const employee = buildEmployee({ workingHours: [{ day: dayName, slots: [{ from: "09:00", to: "10:30" }] }] });
      t.mock.method(employeeRepo, "findEmployeeById", async () => employee);
      t.mock.method(appointmentRepo, "findBusyIntervals", async () => []);

      const slots = await availabilityService.getAvailableSlots({
        serviceId: id().toString(),
        servicePackageId: id().toString(),
        employeeId: employee._id.toString(),
        date,
      });

      // 09:00-10:30, 45-min service, 30-min grid -> 09:00 (ends 09:45), 09:30
      // (ends 10:15). NOT 09:45/10:30 - those would be off-grid start times.
      const slotTimes = slots.map((s) => `${s.startTime.getHours()}:${String(s.startTime.getMinutes()).padStart(2, "0")}`);
      assert.deepEqual(slotTimes, ["9:00", "9:30"]);
    });

    it("removes the busy interval PLUS a 30-minute buffer on both sides", async (t) => {
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

      // busy 10:00-11:00 + 30min buffer on each side -> effectively blocked 09:30-11:30.
      // Working hours are 09:00-13:00, so: [09:00-09:30] is only 30min (too short for a
      // 60min slot, so 09:00 must NOT appear), and [11:30-13:00] is 90min - on the 30-min
      // grid that fits two 60-min slots: 11:30 (ends 12:30) and 12:00 (ends 13:00 exactly).
      const slotTimes = slots.map((s) => `${s.startTime.getHours()}:${String(s.startTime.getMinutes()).padStart(2, "0")}`);
      assert.deepEqual(slotTimes, ["11:30", "12:00"]);
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

  describe("getAvailableSlots - multi-employee merge", () => {
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