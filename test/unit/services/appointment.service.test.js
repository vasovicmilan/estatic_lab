import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import userService from "../../../src/services/user.service.js";
import serviceService from "../../../src/services/service.service.js";
import availabilityService from "../../../src/services/availability.service.js";
import couponService from "../../../src/services/coupon.service.js";
import employeeService from "../../../src/services/employee.service.js";
import packagePurchaseService from "../../../src/services/package-purchase.service.js";
import * as appointmentService from "../../../src/services/appointment.service.js";
import {
  buildAppointment,
  buildEmployee,
  buildUser,
  buildPackagePurchase,
  buildServicePackageVariant,
  id,
} from "../../helpers/factories.js";

// Pinned to a safe mid-day hour, not just "now + 24h" - a raw offset preserves
// whatever time-of-day the suite happens to run at, and if that's late evening,
// start + a service's duration can spill past midnight into the next calendar
// day. Working hours are checked per calendar day (see working-hours.util.js's
// isEmployeeWorkingAt), so a booking that straddles two days can never be fully
// covered by a single day's slot even with an "all day" 00:00-23:59 window -
// this avoids that entirely, the same way booking.http.test.js's futureStartTime()
// already does.
function tomorrowAt10() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
}

describe("appointment.service", () => {
  describe("getAppointmentById - access control", () => {
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

  describe("cancelAppointment - the 24h rule", () => {
    it("blocks a user from cancelling less than 24h before the appointment", async (t) => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
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
      const soon = new Date(Date.now() + 30 * 60 * 1000);
      const appointment = buildAppointment({ status: "confirmed", startTime: soon });
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "cancelled" }));

      await appointmentService.cancelAppointment(appointment._id.toString(), "razlog admina", id().toString(), "admin");
    });
  });

  describe("reassignAppointment", () => {
    // covers every day, all day - buildAppointment()'s default startTime is a fixed
    // date, but using a full week here keeps this robust if that default ever changes
    const alwaysWorking = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => ({
      day,
      slots: [{ from: "00:00", to: "23:59" }],
    }));

    it("refuses to reassign to an employee who's busy at that time", async (t) => {
      const appointment = buildAppointment();
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(employeeService, "getEmployeeByIdRaw", async () => buildEmployee({ workingHours: alwaysWorking }));
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => [buildAppointment()]);

      await assert.rejects(
        () => appointmentService.reassignAppointment(appointment._id.toString(), id().toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("refuses to reassign to an employee who isn't scheduled to work at that time", async (t) => {
      const appointment = buildAppointment();
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(employeeService, "getEmployeeByIdRaw", async () => buildEmployee({ workingHours: [] }));

      await assert.rejects(
        () => appointmentService.reassignAppointment(appointment._id.toString(), id().toString(), id().toString()),
        (err) => err.statusCode === 400
      );
    });

    it("reassigns successfully when the new employee is free and on shift", async (t) => {
      const appointment = buildAppointment();
      const newEmployeeId = id();
      t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
      t.mock.method(employeeService, "getEmployeeByIdRaw", async () => buildEmployee({ _id: newEmployeeId, workingHours: alwaysWorking }));
      t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
      t.mock.method(employeeService, "getEmployeeNameById", async () => "Nova Terapeutkinja");
      let updatePayload;
      t.mock.method(appointmentRepo, "updateAppointmentById", async (appId, patch) => {
        updatePayload = patch;
        return { ...appointment, ...patch };
      });

      await appointmentService.reassignAppointment(appointment._id.toString(), newEmployeeId.toString(), id().toString());

      assert.equal(updatePayload.assignedBy, "admin");
      // was previously asserting `null` here, matching a bug where reassignAppointment
      // always wrote assignedTo: null regardless of who was actually assigned - it must
      // now match the employee being assigned, or the admin detail page's "assigned
      // therapist" display and the /admin/termini unassigned-queue filter break silently
      assert.equal(String(updatePayload.assignedTo), String(newEmployeeId));
      assert.equal(updatePayload.employeeSnapshot.name, "Nova Terapeutkinja");
    });
  });
});

// Fakes mongoose's own session object - bookAppointment calls mongoose.startSession()/
// session.withTransaction()/session.endSession() directly, a real driver-level
// operation no repository/service mock can intercept.
function fakeSession() {
  return {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
}

describe("bookAppointment - employee assignment", () => {
  it("auto-assigns when exactly one employee is free - no real choice is being deferred", async (t) => {
    const soleFreeEmployee = buildEmployee();

    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserByEmail", async () => null);
    t.mock.method(userService, "createGuestUser", async () => buildUser());
    t.mock.method(userService, "findUserById", async () => buildUser());
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 2800, duration: 40 }) }));
    // called twice in the happy path: once before the transaction, once as the
    // in-transaction re-check - both need to agree "exactly one, and it's this one"
    t.mock.method(availabilityService, "findAvailableEmployees", async () => [soleFreeEmployee]);
    t.mock.method(employeeService, "getEmployeeNameById", async () => soleFreeEmployee.userId?.firstName || "Terapeutkinja");
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());

    let createdPayload;
    t.mock.method(appointmentRepo, "createAppointment", async (data) => {
      createdPayload = data;
      return { ...data, _id: id() };
    });

    await appointmentService.bookAppointment({
      serviceId: id().toString(),
      servicePackageId: id().toString(),
      startTime: tomorrowAt10(),
      contact: { firstName: "Ana", email: "ana@example.com" },
    });

    assert.equal(String(createdPayload.employee), String(soleFreeEmployee._id));
    assert.equal(String(createdPayload.assignedTo), String(soleFreeEmployee._id));
    assert.equal(createdPayload.assignedBy, "system");
    assert.ok(createdPayload.assignedAt);
  });

  it("leaves the appointment unassigned when 2+ employees are genuinely free - a real choice for an admin", async (t) => {
    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserByEmail", async () => null);
    t.mock.method(userService, "createGuestUser", async () => buildUser());
    t.mock.method(userService, "findUserById", async () => buildUser());
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 2800, duration: 40 }) }));
    // two DIFFERENT employees are free - genuine ambiguity, nothing should be
    // auto-decided; assignment is left for an admin to pick (see reassignAppointment)
    t.mock.method(availabilityService, "findAvailableEmployees", async () => [buildEmployee(), buildEmployee()]);
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());

    let createdPayload;
    t.mock.method(appointmentRepo, "createAppointment", async (data) => {
      createdPayload = data;
      return { ...data, _id: id() };
    });

    await appointmentService.bookAppointment({
      serviceId: id().toString(),
      servicePackageId: id().toString(),
      startTime: tomorrowAt10(),
      contact: { firstName: "Ana", email: "ana@example.com" },
    });

    assert.equal(createdPayload.employee, null);
    assert.equal(createdPayload.assignedTo, null);
    assert.equal(createdPayload.assignedBy, null);
    assert.equal(createdPayload.assignedAt, null);
  });

  it("rejects the booking when no employee is free at all, even though nobody was explicitly chosen", async (t) => {
    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserByEmail", async () => null);
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 2800, duration: 40 }) }));
    t.mock.method(availabilityService, "findAvailableEmployees", async () => []);

    await assert.rejects(
      () =>
        appointmentService.bookAppointment({
          serviceId: id().toString(),
          servicePackageId: id().toString(),
          startTime: tomorrowAt10(),
          contact: { firstName: "Ana", email: "ana@example.com" },
        }),
      (err) => err.statusCode === 400
    );
  });

  it("honors an explicitly chosen employee - that's a real customer choice, not automatic assignment", async (t) => {
    const chosen = buildEmployee();
    // covers every day/time - this test's startTime is Date.now()+24h (dynamic), and
    // the explicit-employeeId path now also verifies working hours (defense in depth)
    const alwaysWorking = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => ({
      day,
      slots: [{ from: "00:00", to: "23:59" }],
    }));

    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserByEmail", async () => null);
    t.mock.method(userService, "createGuestUser", async () => buildUser());
    t.mock.method(userService, "findUserById", async () => buildUser());
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 2800, duration: 40 }) }));
    t.mock.method(employeeService, "getEmployeeByIdRaw", async () => ({ ...chosen, workingHours: alwaysWorking }));
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());
    t.mock.method(employeeService, "getEmployeeNameById", async () => "Izabrana Terapeutkinja");

    let createdPayload;
    t.mock.method(appointmentRepo, "createAppointment", async (data) => {
      createdPayload = data;
      return { ...data, _id: id() };
    });

    await appointmentService.bookAppointment({
      serviceId: id().toString(),
      servicePackageId: id().toString(),
      employeeId: chosen._id.toString(),
      startTime: tomorrowAt10(),
      contact: { firstName: "Ana", email: "ana@example.com" },
    });

    assert.equal(String(createdPayload.employee), String(chosen._id));
    assert.equal(createdPayload.assignedTo, null);
    assert.equal(createdPayload.assignedBy, null);
    assert.equal(createdPayload.employeeSnapshot.name, "Izabrana Terapeutkinja");
  });
});

describe("bookAppointment - package purchase payment", () => {
  it("rejects packagePurchaseId when the booker isn't logged in", async () => {
    await assert.rejects(
      () =>
        appointmentService.bookAppointment({
          serviceId: id().toString(),
          servicePackageId: id().toString(),
          startTime: tomorrowAt10(),
          isLoggedIn: false,
          contact: { firstName: "Gost", email: "gost@example.com" },
          packagePurchaseId: id().toString(),
        }),
      (err) => err.statusCode === 400
    );
  });

  it("sets finalPrice to 0 and stores the packagePurchase reference when payment is via package", async (t) => {
    const purchase = buildPackagePurchase();
    const loggedInUser = buildUser({ _id: purchase.user });

    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserById", async () => loggedInUser);
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 3000, duration: 60 }) }));
    t.mock.method(availabilityService, "findAvailableEmployees", async () => [buildEmployee()]);
    t.mock.method(employeeService, "getEmployeeNameById", async () => "Terapeutkinja");
    t.mock.method(packagePurchaseService, "assertUsablePurchase", async () => purchase);
    t.mock.method(packagePurchaseService, "reserveSession", async () => {});

    let createdPayload;
    t.mock.method(appointmentRepo, "createAppointment", async (data) => {
      createdPayload = data;
      return { ...data, _id: id() };
    });
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());

    await appointmentService.bookAppointment({
      serviceId: purchase.items[0].service.toString(),
      servicePackageId: purchase.items[0].servicePackageId.toString(),
      startTime: tomorrowAt10(),
      isLoggedIn: true,
      userId: purchase.user.toString(),
      contact: { firstName: "Ana", email: "ana@example.com" },
      packagePurchaseId: purchase._id.toString(),
    });

    assert.equal(createdPayload.finalPrice, 0);
    assert.equal(String(createdPayload.packagePurchase), String(purchase._id));
    assert.equal(createdPayload.coupon, null, "package payment and coupon are mutually exclusive");
  });

  it("skips coupon validation entirely when a packagePurchaseId is provided", async (t) => {
    const purchase = buildPackagePurchase();
    const loggedInUser = buildUser({ _id: purchase.user });

    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserById", async () => loggedInUser);
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 3000, duration: 60 }) }));
    t.mock.method(availabilityService, "findAvailableEmployees", async () => [buildEmployee()]);
    t.mock.method(employeeService, "getEmployeeNameById", async () => "Terapeutkinja");
    t.mock.method(packagePurchaseService, "assertUsablePurchase", async () => purchase);
    t.mock.method(packagePurchaseService, "reserveSession", async () => {});
    const couponMock = t.mock.method(couponService, "validateCouponForBooking", async () => {
      throw new Error("should never be called");
    });
    t.mock.method(appointmentRepo, "createAppointment", async (data) => ({ ...data, _id: id() }));
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());

    await appointmentService.bookAppointment({
      serviceId: purchase.items[0].service.toString(),
      servicePackageId: purchase.items[0].servicePackageId.toString(),
      startTime: tomorrowAt10(),
      isLoggedIn: true,
      userId: purchase.user.toString(),
      contact: { firstName: "Ana", email: "ana@example.com" },
      packagePurchaseId: purchase._id.toString(),
      couponCode: "SHOULDBEIGNORED",
    });

    assert.equal(couponMock.mock.calls.length, 0);
  });

  it("reserves a session at booking time - does NOT commit/consume it yet", async (t) => {
    const purchase = buildPackagePurchase();
    const loggedInUser = buildUser({ _id: purchase.user });

    t.mock.method(mongoose, "startSession", async () => fakeSession());
    t.mock.method(userService, "findUserById", async () => loggedInUser);
    t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: 3000, duration: 60 }) }));
    t.mock.method(availabilityService, "findAvailableEmployees", async () => [buildEmployee()]);
    t.mock.method(employeeService, "getEmployeeNameById", async () => "Terapeutkinja");
    t.mock.method(packagePurchaseService, "assertUsablePurchase", async () => purchase);
    const reserveMock = t.mock.method(packagePurchaseService, "reserveSession", async () => {});
    const commitMock = t.mock.method(packagePurchaseService, "commitSession", async () => {});
    t.mock.method(appointmentRepo, "createAppointment", async (data) => ({ ...data, _id: id() }));
    t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
    t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());

    await appointmentService.bookAppointment({
      serviceId: purchase.items[0].service.toString(),
      servicePackageId: purchase.items[0].servicePackageId.toString(),
      startTime: tomorrowAt10(),
      isLoggedIn: true,
      userId: purchase.user.toString(),
      contact: { firstName: "Ana", email: "ana@example.com" },
      packagePurchaseId: purchase._id.toString(),
    });

    assert.equal(reserveMock.mock.calls.length, 1);
    assert.equal(String(reserveMock.mock.calls[0].arguments[0]), String(purchase._id));
    assert.equal(commitMock.mock.calls.length, 0);
  });
});

describe("completeAppointment / cancelAppointment / rejectAppointment - package session lifecycle", () => {
  it("commits the reservation (reserved -> used) when completed", async (t) => {
    const purchaseId = id();
    const servicePackageId = id();
    const appointment = buildAppointment({
      status: "confirmed",
      packagePurchase: purchaseId,
      variant: { servicePackageId, name: "60 min", duration: 60, price: 3000 },
    });
    t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
    t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "completed" }));
    const commitMock = t.mock.method(packagePurchaseService, "commitSession", async () => {});
    const releaseMock = t.mock.method(packagePurchaseService, "releaseSession", async () => {});

    await appointmentService.completeAppointment(appointment._id.toString(), id().toString(), "admin");

    assert.equal(commitMock.mock.calls.length, 1);
    assert.equal(String(commitMock.mock.calls[0].arguments[0]), String(purchaseId));
    assert.equal(String(commitMock.mock.calls[0].arguments[1]), String(servicePackageId));
    assert.equal(releaseMock.mock.calls.length, 0);
  });

  it("releases the reservation when cancelled by the user", async (t) => {
    const purchaseId = id();
    const servicePackageId = id();
    const owner = buildUser();
    const appointment = buildAppointment({
      status: "confirmed",
      user: owner,
      packagePurchase: purchaseId,
      variant: { servicePackageId, name: "60 min", duration: 60, price: 3000 },
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
    t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "cancelled" }));
    const releaseMock = t.mock.method(packagePurchaseService, "releaseSession", async () => {});
    const commitMock = t.mock.method(packagePurchaseService, "commitSession", async () => {});

    await appointmentService.cancelAppointment(appointment._id.toString(), "razlog", owner._id.toString(), "user");

    assert.equal(releaseMock.mock.calls.length, 1);
    assert.equal(String(releaseMock.mock.calls[0].arguments[0]), String(purchaseId));
    assert.equal(commitMock.mock.calls.length, 0);
  });

  it("releases the reservation when rejected by the assigned employee", async (t) => {
    const purchaseId = id();
    const servicePackageId = id();
    const employeeUser = buildEmployee();
    const appointment = buildAppointment({
      status: "pending",
      employee: employeeUser,
      assignedTo: null,
      packagePurchase: purchaseId,
      variant: { servicePackageId, name: "60 min", duration: 60, price: 3000 },
    });
    t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
    t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "rejected" }));
    const releaseMock = t.mock.method(packagePurchaseService, "releaseSession", async () => {});

    await appointmentService.rejectAppointment(appointment._id.toString(), "razlog", employeeUser._id.toString(), "employee");

    assert.equal(releaseMock.mock.calls.length, 1);
  });

  it("does not touch package-purchase lifecycle for an appointment with no packagePurchase", async (t) => {
    const appointment = buildAppointment({ status: "confirmed", packagePurchase: null });
    t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
    t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "completed" }));
    const commitMock = t.mock.method(packagePurchaseService, "commitSession", async () => {});
    const releaseMock = t.mock.method(packagePurchaseService, "releaseSession", async () => {});

    await appointmentService.completeAppointment(appointment._id.toString(), id().toString(), "admin");

    assert.equal(commitMock.mock.calls.length, 0);
    assert.equal(releaseMock.mock.calls.length, 0);
  });

  it("does not commit/release for a transition to 'confirmed' (only completed/cancelled/rejected touch the lifecycle)", async (t) => {
    const purchaseId = id();
    const servicePackageId = id();
    const appointment = buildAppointment({
      status: "pending",
      packagePurchase: purchaseId,
      variant: { servicePackageId, name: "60 min", duration: 60, price: 3000 },
    });
    t.mock.method(appointmentRepo, "findAppointmentById", async () => appointment);
    t.mock.method(appointmentRepo, "updateAppointmentById", async () => ({ ...appointment, status: "confirmed" }));
    const commitMock = t.mock.method(packagePurchaseService, "commitSession", async () => {});
    const releaseMock = t.mock.method(packagePurchaseService, "releaseSession", async () => {});

    await appointmentService.confirmAppointment(appointment._id.toString(), id().toString(), "admin");

    assert.equal(commitMock.mock.calls.length, 0);
    assert.equal(releaseMock.mock.calls.length, 0);
  });
});