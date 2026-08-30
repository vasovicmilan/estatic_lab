import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPackage, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from package-purchase.spec.js's
 * first case. Packages have no self-checkout (an admin manually records the sale),
 * so the real story has three parts worth showing: admin assigns the package,
 * customer redeems a session through the ordinary booking flow at 0 RSD, admin
 * completing the appointment is what actually "spends" it - not the booking
 * itself. Chronological order matches the real spec: customer needs an account to
 * exist before an admin can pick them from the assignment dropdown, so
 * registration comes first even though the admin's actions are narrated next.
 */
test.describe("Tutorial: kupovina paketa", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin dodeljuje paket, klijent rezerviše besplatnu seansu, admin je završava", async ({ page, browser, tut }) => {
    test.slow();

    const service = await seedService({ price: 4000, duration: 30 });
    await seedEmployee({ service });
    const pkg = await seedPackage({ service, sessions: 3, totalPrice: 9000 });

    const customerEmail = `tutorial-package-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Marko", lastName: "Jović" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    const { default: User } = await import("../../../src/models/user.model.js");
    const customer = await User.findOne({ email: customerEmail });

    // --- admin: dodeljuje paket ---
    const adminEmail = `tutorial-package-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "kupovina-paketa", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Katalog", itemLabel: "Kupljeni paketi", stepIdPrefix: "admin-paketi" });
    await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Dodeli paket", stepIdPrefix: "admin-paketi" });
    await expect(adminPage.locator('select[name="userId"]')).toBeVisible();

    await tut.step("admin-dodeljuje-paket", async () => {
      await adminPage.locator('select[name="userId"]').selectOption(customer._id.toString());
      await adminPage.locator('select[name="packageId"]').selectOption(pkg._id.toString());
      await adminPage.getByRole("button", { name: "Dodeli paket" }).click();
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const { default: PackagePurchase } = await import("../../../src/models/package-purchase.model.js");
    const purchase = await PackagePurchase.findOne({ user: customer._id });

    // --- klijent: bira uslugu, plaća iz paketa (besplatno) ---
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
      await page.locator('a[href*="/podaci?"]').first().click();
      await expect(page).toHaveURL(/\/podaci/);
    });

    await tut.step("placanje-iz-paketa", async () => {
      // se čekira samo automatski kad postoji upotrebljiv paket za baš tu uslugu -
      // videti booking.controller.js's findUsablePurchaseForService
      await expect(page.locator("#usePackagePurchase")).toBeChecked();
      await expect(page.getByText(/preostalo 3 seansi/i)).toBeVisible();
    });

    await tut.step("unos-kontakt-podataka", async () => {
      await typeSlowly(page.locator("#booking-phone"), "0601234567");
    });

    await tut.step("potvrda-zakazivanja", async () => {
      await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
      await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
    });

    const { default: Appointment } = await import("../../../src/models/appointment.model.js");
    const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });

    // --- admin: potvrđuje pa završava termin - ovo troši seansu iz paketa ---
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
      await adminPage.waitForLoadState("networkidle");
    }, { page: adminPage, video: adminVideo });

    const updatedPurchase = await PackagePurchase.findById(purchase._id);
    expect(updatedPurchase.items[0].sessionsUsed).toBe(1);

    await finalizeAdminVideo();
  });
});
