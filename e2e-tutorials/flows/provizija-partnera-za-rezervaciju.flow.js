import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, bookServiceViaNav, clickVisibly, scrollToSmoothly, seedAdminUser, adminSignInViaNav,
  navigateAdminViaMenu, searchAndOpenAdminRecord,
} from "../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPartner, seedCoupon, findAppointmentByEmail, findCommissionEntriesForAppointment, confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "provizija-partnera-za-rezervaciju" / "-mobilni". A partner has TWO commission
 * rates (commissionRateServices / commissionRateProducts, partner.model.js) that are easy to
 * swap - configured very differently (12% vs 99%) so the resulting entry proves the SERVICES
 * rate was used for a booked appointment. Customer books with the partner's coupon (all clicks),
 * then an admin completes the appointment, which is when the commission is calculated.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const { partner } = await seedPartner({ commissionRateServices: 12, commissionRateProducts: 99 });
  const service = await seedService({ price: 4000, duration: 30 });
  await seedEmployee({ service, commissionRate: 25 });
  const coupon = await seedCoupon({ discountType: "fixed", discountValue: 500, partner });
  const customerEmail = `tutorial-partner-booking-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Nemanja", lastName: "Simić" });
  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await bookServiceViaNav(page, tut, { mobile, service });

  await tut.step("unos-podataka-i-kupona", async () => {
    await typeSlowly(page.locator("#booking-phone"), "0601234567");
    const input = page.locator("[data-coupon-input]");
    if (mobile) await scrollToSmoothly(input);
    await typeSlowly(input, coupon.code);
    await clickVisibly(page.locator("[data-coupon-apply-btn]"), { mobile });
    await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
  });
  await tut.step("potvrda-zakazivanja", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi zakazivanje" }), { mobile });
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
  });

  const appointment = await findAppointmentByEmail(customerEmail);
  expect(appointment.coupon.toString()).toBe(coupon._id.toString());

  // --- admin: completes the appointment ---
  const adminEmail = `tutorial-partner-booking-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini", mobile });
  await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-termini", mobile });

  await tut.step("admin-zavrsava-termin", async () => {
    await clickVisibly(adminPage.getByRole("button", { name: "Potvrdi termin" }), { mobile });
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");
    await clickVisibly(adminPage.getByRole("button", { name: "Označi kao završen" }), { mobile });
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video: adminVideo });

  await expect
    .poll(async () => (await findCommissionEntriesForAppointment(appointment._id)).length, { timeout: 10_000 })
    .toBe(2);
  const entries = await findCommissionEntriesForAppointment(appointment._id);
  const partnerEntry = entries.find((e) => e.earnerType === "partner");
  expect(partnerEntry).toBeTruthy();
  expect(partnerEntry.rate).toBe(12);
  expect(partnerEntry.status).toBe("earned");

  await finalizeAdminVideo();
}
