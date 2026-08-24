import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedService,
  seedEmployee,
  seedPackage,
  seedPartner,
  seedCoupon,
  confirmActionModal,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import PackagePurchase from "../../src/models/package-purchase.model.js";
import Appointment from "../../src/models/appointment.model.js";
import CommissionEntry from "../../src/models/commission-entry.model.js";
import User from "../../src/models/user.model.js";

/**
 * End-to-end coverage for the exact commission bug found and fixed while writing
 * BUSINESS-LOGIC.md / POSLOVNA-LOGIKA.md: a commission-based employee's earnings on
 * a package-covered session must be pro-rated by the package's REAL discount rate
 * (price paid / true a la carte total), not by price paid / the package's own
 * already-discounted selling price - see commission.service.js's
 * getPackageProRatedValue and getALaCarteTotal, and the worked examples in section 9
 * of the business logic docs. This had zero E2E coverage before this suite; the unit
 * tests prove the math function is right in isolation, this proves the real flow
 * (admin assigns a package, possibly with a referral coupon, a customer books and an
 * admin completes a session) actually produces that same correct number end to end.
 *
 * Every number below is chosen to exactly match the worked examples in the docs:
 * service price 3000, package of 5 sessions sold for 12000 (a real a la carte total
 * of 15000, i.e. a 20% built-in package discount), employee on 10% commission.
 */
test.describe("Package purchase commission - employee pro-rating and partner referral", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("employee's commission on a package session is pro-rated by the package's real discount, not by its already-discounted selling price", async ({ page, browser }) => {
    test.slow();

    const service = await seedService({ price: 3000, duration: 30 });
    const { employee } = await seedEmployee({ service, commissionRate: 10 });
    // 5 sessions x 3000 a la carte = 15000 true value, sold as a bundle for 12000 -
    // a 20% built-in discount with NO coupon involved at all. This is the exact
    // no-coupon case that exposed the original bug (old formula gave a 1.0 ratio
    // here instead of the correct 0.8).
    const pkg = await seedPackage({ service, sessions: 5, totalPrice: 12000 });

    const customerEmail = `e2e-pkg-commission-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });
    const customer = await User.findOne({ email: customerEmail });

    const adminEmail = `e2e-pkg-commission-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    // --- admin: assign the package, no coupon ---
    await adminPage.goto("/admin/kupljeni-paketi/dodavanje");
    await adminPage.locator('select[name="userId"]').selectOption(customer._id.toString());
    await adminPage.locator('select[name="packageId"]').selectOption(pkg._id.toString());
    await adminPage.getByRole("button", { name: "Dodeli paket" }).click();
    await expectFlashSuccess(adminPage);

    const purchase = await PackagePurchase.findOne({ user: customer._id });
    expect(purchase.originalPrice).toBe(12000);
    expect(purchase.pricePaid).toBe(12000); // no coupon - nothing deducted
    expect(purchase.items[0].unitPrice).toBe(3000); // the snapshotted a la carte price

    // --- customer: book a session, paid from the package ---
    await page.goto(`/zakazivanje/${service.slug}`);
    await page.getByRole("link", { name: "Izaberi" }).click();
    await expect(page).toHaveURL(/\/termin/);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
    await page.locator('a[href*="/podaci?"]').first().click();
    await expect(page).toHaveURL(/\/podaci/);

    await expect(page.locator("#usePackagePurchase")).toBeChecked();
    await page.fill("#booking-phone", "0601234567");
    await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();

    const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });
    expect(appointment.finalPrice).toBe(0); // nothing newly charged - paid from the package

    // --- admin: confirm, then complete - this is what actually triggers commission recording ---
    await adminPage.goto(`/admin/termini/detalji/${appointment._id.toString()}`);
    await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    // commission recording runs asynchronously after the HTTP response - poll,
    // same reasoning as booking-appointment-commission.spec.js
    await expect
      .poll(async () => {
        const entries = await CommissionEntry.find({ appointment: appointment._id }).lean();
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [entry] = await CommissionEntry.find({ appointment: appointment._id }).lean();
    expect(entry.earnerType).toBe("employee");
    // THE REGRESSION CHECK: 3000 * (12000 paid / 15000 true a la carte total) = 2400,
    // never the full undiscounted 3000 the old buggy formula would have produced
    expect(entry.baseValue).toBe(2400);
    expect(entry.amount).toBe(240); // 2400 * 10%

    await adminContext.close();
  });

  test("a package bought through a partner's referral coupon correctly compounds the coupon discount with the package's own built-in discount, for both the partner's and the employee's commission", async ({ page, browser }) => {
    test.slow();

    const { partner } = await seedPartner({ commissionRateServices: 20, commissionRateProducts: 99 });
    const coupon = await seedCoupon({ discountType: "percentage", discountValue: 10, partner });
    const service = await seedService({ price: 3000, duration: 30 });
    const { employee } = await seedEmployee({ service, commissionRate: 10 });
    // Same 15000 true a la carte total (5 x 3000), 12000 bundle price - PLUS the
    // partner's 10% referral coupon applied on top at purchase time.
    const pkg = await seedPackage({ service, sessions: 5, totalPrice: 12000 });

    const customerEmail = `e2e-pkg-referral-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });
    const customer = await User.findOne({ email: customerEmail });

    const adminEmail = `e2e-pkg-referral-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    // --- admin: assign the package, WITH the partner's referral coupon ---
    await adminPage.goto("/admin/kupljeni-paketi/dodavanje");
    await adminPage.locator('select[name="userId"]').selectOption(customer._id.toString());
    await adminPage.locator('select[name="packageId"]').selectOption(pkg._id.toString());
    await adminPage.fill('input[name="couponCode"]', coupon.code);
    await adminPage.getByRole("button", { name: "Dodeli paket" }).click();
    await expectFlashSuccess(adminPage);

    const purchase = await PackagePurchase.findOne({ user: customer._id });
    expect(purchase.originalPrice).toBe(12000);
    expect(purchase.discountApplied).toBe(1200); // 10% of 12000
    expect(purchase.pricePaid).toBe(10800); // what was actually collected

    // --- partner's commission: calculated directly on pricePaid, unaffected by pro-rating ---
    await expect
      .poll(async () => {
        const entries = await CommissionEntry.find({ packagePurchase: purchase._id }).lean();
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [partnerEntry] = await CommissionEntry.find({ packagePurchase: purchase._id }).lean();
    expect(partnerEntry.earnerType).toBe("partner");
    expect(partnerEntry.baseValue).toBe(10800);
    expect(partnerEntry.rate).toBe(20); // commissionRateServices
    expect(partnerEntry.amount).toBe(2160); // 10800 * 20%

    // --- customer: book a session from the package ---
    await page.goto(`/zakazivanje/${service.slug}`);
    await page.getByRole("link", { name: "Izaberi" }).click();
    await expect(page).toHaveURL(/\/termin/);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill("#slots-date", tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
    await page.locator('a[href*="/podaci?"]').first().click();
    await expect(page).toHaveURL(/\/podaci/);

    await expect(page.locator("#usePackagePurchase")).toBeChecked();
    await page.fill("#booking-phone", "0601234567");
    await page.getByRole("button", { name: "Potvrdi zakazivanje" }).click();
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();

    const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });
    expect(appointment.finalPrice).toBe(0);
    // a package-covered appointment never also carries its own coupon - the
    // discount already happened once, at package-purchase time
    expect(appointment.coupon).toBeFalsy();

    // --- admin: confirm, then complete ---
    await adminPage.goto(`/admin/termini/detalji/${appointment._id.toString()}`);
    await adminPage.getByRole("button", { name: "Potvrdi termin" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    await adminPage.getByRole("button", { name: "Označi kao završen" }).click();
    await confirmActionModal(adminPage);
    await adminPage.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const entries = await CommissionEntry.find({ appointment: appointment._id }).lean();
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [employeeEntry] = await CommissionEntry.find({ appointment: appointment._id }).lean();
    expect(employeeEntry.earnerType).toBe("employee");
    // THE CORE ANSWER: 3000 * (10800 paid / 15000 true a la carte total) = 2160 -
    // the referral discount AND the package's own built-in discount both correctly
    // stacked into one combined ratio (0.72), not just one or the other
    expect(employeeEntry.baseValue).toBe(2160);
    expect(employeeEntry.amount).toBe(216); // 2160 * 10%

    await adminContext.close();
  });
});