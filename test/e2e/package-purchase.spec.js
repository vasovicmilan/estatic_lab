import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedService,
  seedEmployee,
  seedPackage,
  confirmActionModal,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import PackagePurchase from "../../src/models/package-purchase.model.js";
import Appointment from "../../src/models/appointment.model.js";
import User from "../../src/models/user.model.js";

/**
 * End-to-end coverage for the package-purchase system - a domain memory notes as
 * central to the business ("multi-session package management") but with zero E2E
 * coverage before this suite. Unlike products/services, packages have no
 * self-checkout: an admin manually records the sale (createPackagePurchase, see
 * package-purchase.controller.js), then the customer redeems sessions against it
 * through the ordinary booking flow. This exercises the full lifecycle a real sale
 * goes through: admin assigns -> customer books using it (0 RSD, a session
 * reserved) -> admin confirms+completes (the reservation is delivered, i.e.
 * "spent") - see appointment.service.js's reserveSession/commitSession comment.
 */
test.describe("Package purchase - admin assigns, customer redeems a session via booking", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("customer books a session from their package for free, and completing it commits the session as used", async ({ page, browser }) => {
    test.slow(); // two-page flow (customer booking + admin confirm/complete), same reasoning as the other multi-actor specs

    const service = await seedService({ price: 4000, duration: 30 });
    const { employee } = await seedEmployee({ service });
    const pkg = await seedPackage({ service, sessions: 3, totalPrice: 9000 });

    const customerEmail = `e2e-package-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });
    const customer = await User.findOne({ email: customerEmail });

    // --- admin: assign the package to this customer ---
    const adminEmail = `e2e-package-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto("/admin/kupljeni-paketi/dodavanje");
    await adminPage.locator('select[name="userId"]').selectOption(customer._id.toString());
    await adminPage.locator('select[name="packageId"]').selectOption(pkg._id.toString());
    await adminPage.getByRole("button", { name: "Dodeli paket" }).click();
    await expectFlashSuccess(adminPage);

    let purchase = await PackagePurchase.findOne({ user: customer._id });
    expect(purchase).toBeTruthy();
    expect(purchase.items[0].sessionsTotal).toBe(3);
    expect(purchase.items[0].sessionsUsed).toBe(0);
    expect(purchase.items[0].sessionsReserved).toBe(0);

    // --- customer: book a session, paid from the package (free) ---
    await page.goto(`/zakazivanje/${service.slug}`);
    await page.getByRole("link", { name: "Izaberi" }).click();
    await expect(page).toHaveURL(/\/termin/);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
    await page.locator('a[href*="/podaci?"]').first().click();
    await expect(page).toHaveURL(/\/podaci/);

    // the "pay from my package" checkbox only renders when a usable purchase
    // exists for this exact service package - see booking.controller.js's
    // findUsablePurchaseForService - and is checked by default
    await expect(page.locator("#usePackagePurchase")).toBeChecked();
    await expect(page.getByText(/preostalo 3 seansi/i)).toBeVisible();

    await page.fill("#booking-phone", "0601234567");
    await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();

    const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });
    expect(appointment.packagePurchase.toString()).toBe(purchase._id.toString());
    expect(appointment.finalPrice).toBe(0); // paid from the package, not charged again

    purchase = await PackagePurchase.findById(purchase._id);
    expect(purchase.items[0].sessionsReserved).toBe(1);
    expect(purchase.items[0].sessionsUsed).toBe(0);

    // --- admin: confirm, then complete - this is what actually "spends" the session ---
    await adminPage.goto(`/admin/termini/detalji/${appointment._id.toString()}`);
    await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    purchase = await PackagePurchase.findById(purchase._id);
    expect(purchase.items[0].sessionsReserved).toBe(0);
    expect(purchase.items[0].sessionsUsed).toBe(1);

    await adminContext.close();
  });

  test("a package with all sessions already used no longer offers the 'pay from package' option", async ({ page, browser }) => {
    const service = await seedService({ price: 3000, duration: 30 });
    await seedEmployee({ service });
    // only 1 session, and it'll be fully spent before the customer tries to book again
    const pkg = await seedPackage({ service, sessions: 1, totalPrice: 3000 });

    const customerEmail = `e2e-package-exhausted-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });
    const customer = await User.findOne({ email: customerEmail });

    // directly mark the package's one session as already used - the exhaustion
    // case itself, not another full booking cycle, is what this test is about
    await PackagePurchase.create({
      user: customer._id,
      package: pkg._id,
      items: [{ service: service._id, servicePackageId: service.packages[0]._id, sessionsTotal: 1, sessionsUsed: 1, sessionsReserved: 0, unitPrice: 3000 }],
      originalPrice: 3000,
      pricePaid: 3000,
      purchasedBy: customer._id,
    });

    await page.goto(`/zakazivanje/${service.slug}`);
    await page.getByRole("link", { name: "Izaberi" }).click();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
    await page.locator('a[href*="/podaci?"]').first().click();

    await expect(page.locator("#usePackagePurchase")).toBeHidden();
  });
});