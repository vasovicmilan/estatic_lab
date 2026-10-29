import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, clickBookNowButton, openListedItem, clickVisibly, chooseDateVisibly,
  selectOptionVisibly, seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, searchAndOpenAdminRecord, clickAdminCreateButton,
} from "../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPackage, confirmActionModal, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "kupovina-paketa" / "kupovina-paketa-mobilni". Packages have no self-checkout:
 * the customer registers, an admin assigns a package to that account, the customer then books
 * through the ordinary flow paying from the package (0 RSD), and the admin completing the
 * appointment is what actually spends the session. Both actors use the same device type.
 * Every page is reached by clicking (menus, cards, buttons) - no page.goto() except the start.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const service = await seedService({ price: 4000, duration: 30 });
  await seedEmployee({ service });
  const pkg = await seedPackage({ service, sessions: 3, totalPrice: 9000 });
  const customerEmail = `tutorial-package-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Marko", lastName: "Jović" });

  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  const { default: User } = await import("../../src/models/user.model.js");
  const customer = await User.findOne({ email: customerEmail });

  // --- admin: assigns the package ---
  const adminEmail = `tutorial-package-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Katalog", itemLabel: "Kupljeni paketi", stepIdPrefix: "admin-paketi", mobile });
  await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Dodeli paket", stepIdPrefix: "admin-paketi" });
  await expect(adminPage.locator('select[name="userId"]')).toBeVisible();

  await tut.step("admin-dodeljuje-paket", async () => {
    await selectOptionVisibly(adminPage.locator('select[name="userId"]'), customer._id.toString());
    await selectOptionVisibly(adminPage.locator('select[name="packageId"]'), pkg._id.toString());
    await clickVisibly(adminPage.getByRole("button", { name: "Dodeli paket" }), { mobile });
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  const { default: PackagePurchase } = await import("../../src/models/package-purchase.model.js");
  const purchase = await PackagePurchase.findOne({ user: customer._id });

  // --- customer: books a session paid from the package ---
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

  await tut.step("placanje-iz-paketa", async () => {
    // pre-ticked only when a usable package exists for exactly this service -
    // see booking.controller.js's findUsablePurchaseForService
    await expect(page.locator("#usePackagePurchase")).toBeChecked();
    await expect(page.getByText(/preostalo 3 seansi/i)).toBeVisible();
  });

  await tut.step("unos-kontakt-podataka", async () => {
    await typeSlowly(page.locator("#booking-phone"), "0601234567");
  });

  await tut.step("potvrda-zakazivanja", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi zakazivanje" }), { mobile });
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
  });

  // --- admin: confirms, then completes - this spends the session from the package ---
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
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video: adminVideo });

  const updatedPurchase = await PackagePurchase.findById(purchase._id);
  expect(updatedPurchase.items[0].sessionsUsed).toBe(1);

  await finalizeAdminVideo();
}
