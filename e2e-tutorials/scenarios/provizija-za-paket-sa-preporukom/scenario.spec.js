import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPackage, seedPartner, seedCoupon, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import CommissionEntry from "../../../src/models/commission-entry.model.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * package-purchase-commission.spec.js's second (referral) case, which itself
 * exists to prove a real bug fix: an employee's commission on a package session
 * must be pro-rated by the package's REAL combined discount (referral coupon
 * stacked with the package's own built-in discount), not by price-paid divided
 * by the package's already-discounted selling price alone. Numbers below exactly
 * match BUSINESS-LOGIC.md's worked example (service 3000, 5-session package sold
 * for 12000 = a real à la carte value of 15000, plus a 10% referral coupon on
 * top) specifically so this tutorial doubles as a live demonstration of the
 * correct math, not just the click-path.
 */
test.describe("Tutorial: provizija za paket sa preporukom partnera", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("provizija partnera i zaposlenog se ispravno obračunavaju kad se popust kupona i popust paketa saberu", async ({ page, browser, tut }) => {
    test.slow();

    const { partner } = await seedPartner({ commissionRateServices: 20, commissionRateProducts: 99 });
    const coupon = await seedCoupon({ discountType: "percentage", discountValue: 10, partner });
    const service = await seedService({ price: 3000, duration: 30 });
    const { employee } = await seedEmployee({ service, commissionRate: 10 });
    // 5 seansi x 3000 = 15000 prava vrednost, paket se prodaje za 12000 - PLUS
    // partnerov kupon od 10% preko toga, pri samoj kupovini paketa
    const pkg = await seedPackage({ service, sessions: 5, totalPrice: 12000 });

    const customerEmail = `tutorial-pkg-referral-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Milica", lastName: "Stanković" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    const { default: User } = await import("../../../src/models/user.model.js");
    const customer = await User.findOne({ email: customerEmail });

    const adminEmail = `tutorial-pkg-referral-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "provizija-za-paket-sa-preporukom", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Katalog", itemLabel: "Kupljeni paketi", stepIdPrefix: "admin-paketi" });
    await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Dodeli paket", stepIdPrefix: "admin-paketi" });

    await tut.step("admin-dodeljuje-paket-sa-kuponom", async () => {
      await adminPage.locator('select[name="userId"]').selectOption(customer._id.toString());
      await adminPage.locator('select[name="packageId"]').selectOption(pkg._id.toString());
      await typeSlowly(adminPage.locator('input[name="couponCode"]'), coupon.code);
      await adminPage.getByRole("button", { name: "Dodeli paket" }).click();
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const { default: PackagePurchase } = await import("../../../src/models/package-purchase.model.js");
    const purchase = await PackagePurchase.findOne({ user: customer._id });
    expect(purchase.originalPrice).toBe(12000);
    expect(purchase.discountApplied).toBe(1200); // 10% od 12000
    expect(purchase.pricePaid).toBe(10800); // stvarno naplaćeno

    // partnerova provizija se računa direktno na pricePaid, bez pro-rating-a - ovo
    // je pozadinska provera direktno iz baze (kao i u pravom e2e testu), nema
    // odgovarajuću UI stranicu vrednu prikazivanja u tutorijalu
    await expect
      .poll(async () => {
        const entries = await CommissionEntry.find({ packagePurchase: purchase._id }).lean();
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [partnerEntry] = await CommissionEntry.find({ packagePurchase: purchase._id }).lean();
    expect(partnerEntry.earnerType).toBe("partner");
    expect(partnerEntry.baseValue).toBe(10800);
    expect(partnerEntry.amount).toBe(2160); // 10800 * 20%

    // --- klijent: rezerviše seansu iz paketa ---
    await tut.step("klijent-rezervise-seansu", async () => {
      await page.goto(`/zakazivanje/${service.slug}`);
      await page.getByRole("link", { name: "Izaberi" }).click();
      await expect(page).toHaveURL(/\/termin/);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
      await page.waitForLoadState("networkidle");
      await page.locator('a[href*="/podaci?"]').first().click();
      await expect(page.locator("#usePackagePurchase")).toBeChecked();

      await typeSlowly(page.locator("#booking-phone"), "0601234567");
      await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
      await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
    });

    const { default: Appointment } = await import("../../../src/models/appointment.model.js");
    const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });
    expect(appointment.finalPrice).toBe(0);

    // --- admin: potvrđuje pa završava - ovo obračunava proviziju zaposlenog ---
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
        const entries = await CommissionEntry.find({ appointment: appointment._id }).lean();
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    // pozadinska provera direktno iz baze, kao i kod partnerove provizije iznad
    const [employeeEntry] = await CommissionEntry.find({ appointment: appointment._id }).lean();
    expect(employeeEntry.earnerType).toBe("employee");
    // KLJUČNA PROVERA: 3000 * (10800 plaćeno / 15000 prava vrednost) = 2160 -
    // popust kupona I ugrađeni popust paketa se ispravno sabiraju u jedan
    // kombinovani odnos (0.72), ne primenjuje se samo jedan ili drugi
    expect(employeeEntry.baseValue).toBe(2160);
    expect(employeeEntry.amount).toBe(216); // 2160 * 10%

    await finalizeAdminVideo();
  });
});
