import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - covers the same real flow as
 * test/e2e/booking-appointment-commission.spec.js (customer books a service,
 * admin confirms then completes it) but simplified for narration: no coupon, no
 * partner/commission assertions, since those are a second, separate story to
 * tell (see e2e-tutorials/README.md on splitting one e2e spec into >1 scenario
 * when it covers more than one thing worth narrating on its own).
 *
 * Every test.step() below is wrapped as tut.step(id, fn) instead - `id` is the
 * key that e2e-tutorials/scenarios/zakazivanje-termina/narration.json attaches
 * sr/en text to. Keep ids and their meaning in sync if this scenario changes;
 * build-docs.mjs falls back to the raw id as a heading if narration.json has
 * nothing for it, so a stale/missing id fails loud (an odd heading in the
 * generated doc), not silent.
 */
test.describe("Tutorial: zakazivanje termina", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("klijent zakazuje termin, admin ga potvrđuje i završava", async ({ page, browser, tut }) => {
    test.slow();

    const service = await seedService({ price: 4000, duration: 30 });
    await seedEmployee({ service, commissionRate: 25 });

    const customerEmail = `tutorial-booking-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Ana", lastName: "Petrović" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    await tut.step("otvaranje-stranice-usluge", async () => {
      await page.goto(`/zakazivanje/${service.slug}`);
      await expect(page.getByRole("link", { name: "Izaberi" })).toBeVisible();
    });

    await tut.step("izbor-varijante-usluge", async () => {
      await page.getByRole("link", { name: "Izaberi" }).click();
      await expect(page).toHaveURL(/\/termin/);
    });

    await tut.step("izbor-datuma-i-termina", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = tomorrow.toISOString().slice(0, 10);
      await page.fill("#slots-date", tomorrowIso);
      await page.waitForLoadState("networkidle");
      await page.locator(".btn-outline-primary").first().click();
      await expect(page).toHaveURL(/\/podaci/);
    });

    await tut.step("unos-kontakt-podataka", async () => {
      await typeSlowly(page.locator("#booking-phone"), "0601234567");
    });

    await tut.step("potvrda-zakazivanja", async () => {
      await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
      await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
    });

    // --- admin strana: potvrda pa završetak termina ---
    // admin nalog se pravi direktno u bazi (seedAdminUser), ne kroz UI - videti
    // slow-actions.js: registracija+promoteToAdmin-ov logout/login bi ovde bio
    // "mrtav" deo videa bez ijednog koraka/naracije koji bi ga objasnio.
    const adminEmail = `tutorial-booking-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "zakazivanje-termina", "admin-flow");
    const adminPage = await adminContext.newPage();

    const { default: Appointment } = await import("../../../src/models/appointment.model.js");
    const appointment = await Appointment.findOne({ "contactSnapshot.email": customerEmail }).sort({ createdAt: -1 });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini" });
    await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-termini" });
    await expect(adminPage.getByRole("button", { name: "Potvrdi termin" })).toBeVisible();

    await tut.step("admin-potvrdjuje-termin", async () => {
      await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
      await confirmActionModal(adminPage);
      await adminPage.waitForLoadState("networkidle");
    }, { page: adminPage, video: adminVideo });

    await tut.step("admin-zavrsava-termin", async () => {
      await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    await finalizeAdminVideo();
  });
});
