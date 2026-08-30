import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPartner, seedCoupon, findAppointmentByEmail, findCommissionEntriesForAppointment, confirmActionModal } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * booking-appointment-commission.spec.js. Worth its own tutorial specifically
 * because a partner has TWO separate commission rates (commissionRateServices
 * and commissionRateProducts, partner.model.js) that are easy to accidentally
 * swap - this scenario deliberately configures them very differently (12% vs
 * 99%) so the resulting commission entry proves the SERVICES rate was actually
 * used for a booked appointment, not just "some rate that happened to be set".
 * provizija-za-paket-sa-preporukom already covers the products/package side of
 * this same split; this is the services/booking side.
 */
test.describe("Tutorial: provizija partnera za rezervaciju termina", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("partner zarađuje proviziju po stopi za usluge, ne za proizvode, preko rezervisanog termina", async ({ page, browser, tut }) => {
    test.slow();

    // namerno vrlo različite stope - ako bi sistem greškom pomešao services i
    // products proviziju, ovaj test bi to odmah uhvatio
    const { partner } = await seedPartner({ commissionRateServices: 12, commissionRateProducts: 99 });
    const service = await seedService({ price: 4000, duration: 30 });
    const { employee } = await seedEmployee({ service, commissionRate: 25 });
    const coupon = await seedCoupon({ discountType: "fixed", discountValue: 500, partner });

    const customerEmail = `tutorial-partner-booking-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Nemanja", lastName: "Simić" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    await tut.step("otvaranje-stranice-usluge", async () => {
      await page.goto(`/zakazivanje/${service.slug}`);
      await page.getByRole("link", { name: "Izaberi" }).click();
      await expect(page).toHaveURL(/\/termin/);
    });

    await tut.step("izbor-datuma-i-termina", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
      await page.waitForLoadState("networkidle");
      await page.locator(".btn-outline-primary").first().click();
      await expect(page).toHaveURL(/\/podaci/);
    });

    await tut.step("unos-podataka-i-kupona", async () => {
      await typeSlowly(page.locator("#booking-phone"), "0601234567");
      await typeSlowly(page.locator("[data-coupon-input]"), coupon.code);
      await page.click("[data-coupon-apply-btn]");
      await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
    });

    await tut.step("potvrda-zakazivanja", async () => {
      await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
      await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
    });

    const appointment = await findAppointmentByEmail(customerEmail);
    expect(appointment.coupon.toString()).toBe(coupon._id.toString());

    // --- admin: potvrđuje pa završava termin - ovo obračunava obe provizije ---
    const adminEmail = `tutorial-partner-booking-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "provizija-partnera-za-rezervaciju", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini" });
    await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-termini" });

    await tut.step("admin-zavrsava-termin", async () => {
      await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
      await confirmActionModal(adminPage);
      await adminPage.waitForLoadState("networkidle");

      await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
      await confirmActionModal(adminPage);
      await adminPage.waitForLoadState("networkidle");
    }, { page: adminPage, video: adminVideo });

    await expect
      .poll(async () => {
        const entries = await findCommissionEntriesForAppointment(appointment._id);
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(2);

    const entries = await findCommissionEntriesForAppointment(appointment._id);
    const partnerEntry = entries.find((e) => e.earnerType === "partner");
    expect(partnerEntry).toBeTruthy();
    // KLJUČNA PROVERA: 12% (commissionRateServices), NIKAD 99% (commissionRateProducts)
    expect(partnerEntry.rate).toBe(12);
    expect(partnerEntry.status).toBe("earned");

    await finalizeAdminVideo();
  });
});
