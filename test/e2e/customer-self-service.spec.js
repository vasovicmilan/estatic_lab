import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  seedService,
  seedAppointment,
  seedOrder,
  confirmActionModal,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import Appointment from "../../src/models/appointment.model.js";
import Order from "../../src/models/order.model.js";
import User from "../../src/models/user.model.js";

/**
 * End-to-end coverage for a customer managing their OWN appointments and orders
 * through /nalog - never exercised through a real browser before this suite
 * existed, and a third distinct "who can act on this" code path alongside the
 * admin panel (booking-appointment-commission.spec.js) and the employee's own
 * panel (employee-appointment-management.spec.js). Same underlying
 * appointmentService.cancelAppointment/orderService.cancelOrder functions, but
 * this is the only place that exercises the user-role branch of
 * canAccessAppointment/canAccessOrder and the 24h cancellation cutoff
 * (appointment-cancellation.util.js's canUserCancelAppointment).
 */
test.describe("Customer self-service - viewing and cancelling own appointments/orders", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("a customer sees, then cancels, their own upcoming appointment", async ({ page }) => {
    const service = await seedService({ price: 2500, duration: 30 });
    const customerEmail = `e2e-selfservice-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    const customer = await User.findOne({ email: customerEmail });
    // 3 days out, comfortably past the 24h cancellation cutoff
    // (USER_CANCELLATION_CUTOFF_HOURS - see appointment-cancellation.util.js) -
    // seeding at exactly 24h would risk the window closing mid-test as real time
    // elapses between seeding and the cancel click
    const appointment = await seedAppointment({ service, status: "confirmed", customer, daysAhead: 3 });

    await page.goto("/nalog/termini");
    await expect(page.getByText("Standard")).toBeVisible();

    await page.goto(`/nalog/termini/detalji/${appointment._id.toString()}`);
    await page.getByRole("button", { name: "Otkaži termin" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    const updated = await Appointment.findById(appointment._id);
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledBy).toBe("user");
  });

  test("a customer cannot cancel an appointment too close to its start time", async ({ page }) => {
    const service = await seedService({ price: 2500, duration: 30 });
    const customerEmail = `e2e-selfservice-tooclose-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    const customer = await User.findOne({ email: customerEmail });
    // well inside the 24h cutoff - the "Cancel" button itself must not even
    // render (see appointment-details.ejs's data.canCancel), matching what
    // canUserCancelAppointment computes server-side
    const appointment = await seedAppointment({ service, status: "confirmed", customer, daysAhead: 0.1 });

    await page.goto(`/nalog/termini/detalji/${appointment._id.toString()}`);
    await expect(page.getByRole("button", { name: "Otkaži termin" })).toBeHidden();

    const stillUnchanged = await Appointment.findById(appointment._id);
    expect(stillUnchanged.status).toBe("confirmed");
  });

  test("a customer cannot see or cancel another customer's appointment", async ({ page }) => {
    const service = await seedService({ price: 2500, duration: 30 });
    const owner = await seedAppointment({ service, status: "confirmed", daysAhead: 3 }); // seeds its own random customer

    const outsiderEmail = `e2e-selfservice-outsider-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: outsiderEmail });

    await page.goto(`/nalog/termini/detalji/${owner._id.toString()}`);
    await expect(page.getByText(/nemate pristup|nije pronađen/i)).toBeVisible();
  });

  test("a customer sees, then cancels, their own pending order", async ({ page }) => {
    const customerEmail = `e2e-selfservice-order-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    const customer = await User.findOne({ email: customerEmail });
    const order = await seedOrder({ customer, status: "pending", subtotal: 4500 });

    await page.goto("/nalog/porudzbine");
    await expect(page.getByText("1 stavki")).toBeVisible();

    await page.goto(`/nalog/porudzbine/detalji/${order._id.toString()}`);
    await expect(page.getByText("E2E Test Proizvod")).toBeVisible();
    await page.getByRole("button", { name: "Otkaži porudžbinu" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    const updated = await Order.findById(order._id);
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledBy).toBe("user");
  });

  test("a customer cannot cancel an order that's already past 'pending' (e.g. processing)", async ({ page }) => {
    const customerEmail = `e2e-selfservice-order-processing-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    const customer = await User.findOne({ email: customerEmail });
    // canUserCancelOrder only allows "pending" - see order-status-transitions.js
    const order = await seedOrder({ customer, status: "processing", subtotal: 4500 });

    await page.goto(`/nalog/porudzbine/detalji/${order._id.toString()}`);
    await expect(page.getByRole("button", { name: "Otkaži porudžbinu" })).toBeHidden();

    const stillUnchanged = await Order.findById(order._id);
    expect(stillUnchanged.status).toBe("processing");
  });
});