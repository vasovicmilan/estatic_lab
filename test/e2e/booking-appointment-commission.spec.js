import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedService,
  seedEmployee,
  seedPartner,
  seedCoupon,
  findAppointmentByEmail,
  findCommissionEntriesForAppointment,
  confirmActionModal,
} from "./helpers/e2e-helpers.js";

/**
 * End-to-end coverage for the core booking flow - never exercised through a real
 * browser before this suite existed - and for the appointment-side half of the
 * commissionRateServices/commissionRateProducts split (see partner.model.js /
 * commission.service.js). coupon-product-discount.spec.js already covers the
 * *products* side end-to-end via an order; this covers the *services* side via a
 * booked appointment, so the whole split has real browser coverage on both ends,
 * not just in unit tests where the two sides are easy to accidentally swap without
 * anything catching it.
 *
 * Unlike order confirmation, a booked appointment starts "pending" and commission
 * is only recorded once an admin marks it "completed" - see
 * appointment-status-transitions.js (pending -> confirmed -> completed, no
 * skipping straight to completed) and commission.listener.js (only reacts to
 * appointment:status_changed with status "completed"). The admin steps below are
 * not incidental scaffolding; they're the actual trigger this test is checking.
 */
test.describe("Booking - appointment scheduling and services-side commission", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("books an appointment end-to-end, and records both the employee's and the partner's commission - at commissionRateServices, not Products - once an admin completes it", async ({ page, browser }) => {
    test.slow(); // two-page flow (customer booking + admin confirm/complete), same reasoning as checkout-freight-shipping.spec.js

    const { partner } = await seedPartner({ commissionRateServices: 12, commissionRateProducts: 99 });
    const service = await seedService({ price: 4000, duration: 30 });
    const { employee } = await seedEmployee({ service, commissionRate: 25 });
    const coupon = await seedCoupon({ discountType: "fixed", discountValue: 500, partner });

    const customerEmail = `e2e-booking-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    await page.goto(`/zakazivanje/${service.slug}`);
    await page.getByRole("link", { name: "Izaberi" }).click();
    await expect(page).toHaveURL(/\/termin/);

    // pick tomorrow explicitly - "today" risks running out of remaining slots
    // depending on what time of day the suite happens to run, even with the
    // employee's working hours set to cover the whole day (see seedEmployee)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    await page.fill("#slots-date", tomorrowIso);
    await page.waitForLoadState("networkidle");

    await page.locator(".btn-outline-primary").first().click();
    await expect(page).toHaveURL(/\/podaci/);

    await page.fill("#booking-phone", "0601234567");
    await page.fill("[data-coupon-input]", coupon.code);
    await page.click("[data-coupon-apply-btn]");
    await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();

    await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();

    const appointment = await findAppointmentByEmail(customerEmail);
    expect(appointment.status).toBe("pending");
    expect(appointment.coupon.toString()).toBe(coupon._id.toString());

    // --- admin: confirm, then complete the appointment ---
    const adminEmail = `e2e-booking-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto(`/admin/termini/detalji/${appointment._id.toString()}`);
    await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    // appointment:status_changed's commission-recording listener runs
    // asynchronously after the HTTP response (see commission.listener.js) - poll
    // rather than assert immediately, same reasoning as coupon-product-discount.spec.js
    await expect
      .poll(async () => {
        const entries = await findCommissionEntriesForAppointment(appointment._id);
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(2);

    const entries = await findCommissionEntriesForAppointment(appointment._id);
    const employeeEntry = entries.find((e) => e.earnerType === "employee");
    const partnerEntry = entries.find((e) => e.earnerType === "partner");

    expect(employeeEntry).toBeTruthy();
    expect(employeeEntry.rate).toBe(25);
    expect(employeeEntry.status).toBe("earned");

    expect(partnerEntry).toBeTruthy();
    expect(partnerEntry.rate).toBe(12); // commissionRateServices, never the 99 from commissionRateProducts
    expect(partnerEntry.status).toBe("earned");

    await adminContext.close();
  });
});