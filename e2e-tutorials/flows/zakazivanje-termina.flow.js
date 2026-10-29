import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, clickBookNowButton, openListedItem, clickVisibly, chooseDateVisibly,
  seedAdminUser, goToLoginViaNav, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord, tutFor,
} from "../scripts/slow-actions.js";
import { seedService, seedEmployee, confirmActionModal, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "zakazivanje-termina" / "zakazivanje-termina-mobilni" - the full booking:
 * the customer books, then an admin confirms and completes the appointment. Both actors
 * are on the same device type (a phone scenario records the admin on a phone as well, so
 * merge-video.mjs can join the two recordings).
 * Customer path, all clicks: home -> "Registracija" -> form -> login -> header "Zakažite
 * termin" -> the service's card -> "Zakaži" on a variant -> date -> time slot -> phone ->
 * "Potvrdi zakazivanje". Admin path: home -> "Prijava" -> form -> account menu -> "Admin
 * panel" -> admin menu "Zakazivanje" > "Termini" -> search -> open -> confirm -> complete.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const service = await seedService({ price: 4000, duration: 30 });
  await seedEmployee({ service, commissionRate: 25 });
  const customerEmail = `tutorial-booking-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Ana", lastName: "Petrović" });

  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await clickBookNowButton(page, tut, { mobile });
  await openListedItem(page, tut, { mobile, href: `/usluge/${service.slug}`, id: "otvaranje-stranice-usluge" });

  await tut.step("izbor-varijante-usluge", async () => {
    await clickVisibly(page.locator(`main a[href*="/zakazivanje/${service.slug}/termin"]`), { mobile });
    await expect(page).toHaveURL(/\/termin/);
  });

  await tut.step("izbor-datuma", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await chooseDateVisibly(page.locator("#slots-date"), tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
  });

  await tut.step("izbor-termina", async () => {
    await clickVisibly(page.locator('a[href*="/podaci?"]'), { mobile });
    await expect(page).toHaveURL(/\/podaci/);
  });

  await tut.step("unos-kontakt-podataka", async () => {
    await typeSlowly(page.locator("#booking-phone"), "0601234567");
  });

  await tut.step("potvrda-zakazivanja", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi zakazivanje" }), { mobile });
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
  });

  // --- admin: potvrda pa završetak termina ---
  // the admin account is created straight in the database (seedAdminUser) - the real
  // registration + promote-to-admin round trip would be dead air with nothing to narrate
  const adminEmail = `tutorial-booking-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();
  const adminTut = tutFor(tut, adminPage, adminVideo);

  await tut.step("admin-otvaranje-pocetne", async () => {
    await adminPage.goto("/");
    await expect(adminPage.locator("main")).toBeVisible();
  }, { page: adminPage, video: adminVideo });

  await goToLoginViaNav(adminPage, adminTut, { mobile, stepIdPrefix: "admin-login" });

  await tut.step("admin-prijava", async () => {
    await fillLoginFormSlowly(adminPage, { email: adminEmail });
  }, { page: adminPage, video: adminVideo });

  await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak", mobile });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini", mobile });
  await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-termini", mobile });
  await expect(adminPage.getByRole("button", { name: "Potvrdi termin" })).toBeVisible();

  await tut.step("admin-potvrdjuje-termin", async () => {
    await clickVisibly(adminPage.getByRole("button", { name: "Potvrdi termin" }), { mobile });
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video: adminVideo });

  await tut.step("admin-zavrsava-termin", async () => {
    await clickVisibly(adminPage.getByRole("button", { name: "Označi kao završen" }), { mobile });
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  await finalizeAdminVideo();
}
