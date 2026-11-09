import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import userService from "../../../src/services/user.service.js";
import serviceService from "../../../src/services/service.service.js";
import availabilityService from "../../../src/services/availability.service.js";
import employeeService from "../../../src/services/employee.service.js";
import * as appointmentService from "../../../src/services/appointment.service.js";
import { buildAppointment, buildCoupon, buildEmployee, buildUser, buildServicePackageVariant, id } from "../../helpers/factories.js";

// A coupon from the prize wheel (or any single-use coupon) is redeemed by a visitor who is NOT logged in.
// These pin down what happens to them: with an existing account (same email) the coupon is attached to
// THAT account, with no account one is created in the same transaction, and "once per person" holds either way.

function tomorrowAt10() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
}

function wire(t, { existingUser = null, coupon, serviceId, usageByUser = 0, price = 2000 }) {
  const calls = { guestCreated: 0, usageCheckedFor: [], redeemed: null, createdAppointment: null };
  const guest = buildUser({ email: "novi@example.com" });
  const free = buildEmployee();

  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
  t.mock.method(userService, "findUserByEmail", async () => existingUser);
  t.mock.method(userService, "createGuestUser", async () => { calls.guestCreated++; return guest; });
  t.mock.method(userService, "findUserById", async () => existingUser || guest);
  t.mock.method(serviceService, "getActiveVariant", async () => ({ variant: buildServicePackageVariant({ totalPrice: price, duration: 30 }) }));
  t.mock.method(availabilityService, "findAvailableEmployees", async () => [free]);
  t.mock.method(employeeService, "getEmployeeNameById", async () => "Terapeut");
  t.mock.method(appointmentRepo, "findOverlappingAppointments", async () => []);
  t.mock.method(appointmentRepo, "findAppointmentById", async () => buildAppointment());
  t.mock.method(appointmentRepo, "createAppointment", async (data) => { calls.createdAppointment = data; return { ...data, _id: id() }; });
  t.mock.method(couponRepo, "findCouponByCode", async () => coupon);
  t.mock.method(couponRepo, "countCouponUsagesByUser", async (_cid, uid) => { calls.usageCheckedFor.push(String(uid)); return usageByUser; });
  t.mock.method(couponRepo, "redeemCoupon", async (_cid, data) => { calls.redeemed = data; return { ...coupon, usedCount: 1 }; });
  return { calls, guest };
}

const book = (serviceId, extra = {}) =>
  appointmentService.bookAppointment({
    serviceId: serviceId.toString(),
    servicePackageId: id().toString(),
    startTime: tomorrowAt10(),
    contact: { firstName: "Ana", lastName: "Anić", email: "ana@example.com", phone: "0641234567" },
    couponCode: "TOCAK-ABC234",
    ...extra,
  });

describe("booking with a coupon while NOT logged in", () => {
  it("attaches the coupon to the existing account found by email - no second account is created", async (t) => {
    const serviceId = id();
    const existing = buildUser({ email: "ana@example.com" });
    const coupon = buildCoupon({ code: "TOCAK-ABC234", maxUses: 1, applicableServices: [serviceId] });
    const { calls } = wire(t, { existingUser: existing, coupon, serviceId });

    await book(serviceId);

    assert.equal(calls.guestCreated, 0, "an account with this email already exists");
    assert.equal(String(calls.redeemed.userId), String(existing._id));
    assert.equal(String(calls.createdAppointment.user), String(existing._id));
    assert.deepEqual(calls.usageCheckedFor, [String(existing._id)], "the once-per-person check runs against that account");
  });

  it("gives a free treatment a final price of 0 and records the discount", async (t) => {
    const serviceId = id();
    const coupon = buildCoupon({ code: "TOCAK-ABC234", discountValue: 100, maxDiscountAmount: 2000, maxUses: 1, applicableServices: [serviceId] });
    const { calls } = wire(t, { existingUser: buildUser({ email: "ana@example.com" }), coupon, serviceId, price: 2000 });

    await book(serviceId);

    assert.equal(calls.redeemed.discountAmount, 2000);
    assert.equal(calls.createdAppointment.finalPrice, 0);
  });

  it("creates the account in the same booking when none exists, and redeems the coupon on it", async (t) => {
    const serviceId = id();
    const coupon = buildCoupon({ code: "TOCAK-ABC234", maxUses: 1, applicableServices: [serviceId] });
    const { calls, guest } = wire(t, { existingUser: null, coupon, serviceId });

    await book(serviceId);

    assert.equal(calls.guestCreated, 1);
    assert.equal(String(calls.redeemed.userId), String(guest._id));
    assert.equal(calls.usageCheckedFor.length, 0, "a brand-new account has no earlier uses to count");
  });

  it("rejects the coupon when the existing account has already used it (once per person)", async (t) => {
    const serviceId = id();
    const coupon = buildCoupon({ code: "TOCAK-ABC234", maxUses: 1, maxUsesPerUser: 1, applicableServices: [serviceId] });
    const { calls } = wire(t, { existingUser: buildUser({ email: "ana@example.com" }), coupon, serviceId, usageByUser: 1 });

    await assert.rejects(() => book(serviceId), (e) => e.statusCode === 400);
    assert.equal(calls.createdAppointment, null, "nothing may be booked");
    assert.equal(calls.redeemed, null);
  });

  it("rejects a coupon that is tied to a different service", async (t) => {
    const coupon = buildCoupon({ code: "TOCAK-ABC234", maxUses: 1, applicableServices: [id()] });
    const serviceId = id();
    const { calls } = wire(t, { existingUser: buildUser({ email: "ana@example.com" }), coupon, serviceId });

    await assert.rejects(() => book(serviceId), (e) => e.statusCode === 400);
    assert.equal(calls.createdAppointment, null);
  });

  it("rejects a single-use coupon that somebody else already used up", async (t) => {
    const serviceId = id();
    const coupon = buildCoupon({ code: "TOCAK-ABC234", maxUses: 1, usedCount: 1, applicableServices: [serviceId] });
    const { calls } = wire(t, { existingUser: null, coupon, serviceId });

    await assert.rejects(() => book(serviceId), (e) => e.statusCode === 400);
    assert.equal(calls.guestCreated, 0, "no account is created for a booking that is refused");
  });
});
