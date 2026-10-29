import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, bookServiceViaNav, clickVisibly, selectOptionVisibly, seedAdminUser, adminSignInViaNav,
  navigateAdminViaMenu, searchAndOpenAdminRecord, clickAdminCreateButton,
} from "../scripts/slow-actions.js";
import { seedService, seedEmployee, seedPartner, seedCoupon, seedPackage, confirmActionModal, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import CommissionEntry from "../../src/models/commission-entry.model.js";

/**
 * Shared flow of "provizija-za-paket-sa-preporukom" / "-mobilni". A package bought with a partner's
 * referral coupon combines two discounts (the coupon and the package's built-in one); the partner's
 * commission is on what was really paid, the employee's is pro-rated by the combined ratio - and,
 * because the session is paid from a package, floored by the "minimumSessionCommission" setting
 * (commission.service.js's isFloorEligible, 500 by default). The commission itself has no page worth
 * showing, so it is asserted straight from the database, like in the regression test.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const { partner } = await seedPartner({ commissionRateServices: 20, commissionRateProducts: 99 });
  const coupon = await seedCoupon({ discountType: "percentage", discountValue: 10, partner });
  const service = await seedService({ price: 3000, duration: 30 });
  await seedEmployee({ service, commissionRate: 10 });
  // 5 sessions x 3000 = 15000 true value, the package sells for 12000 - PLUS the partner's 10% coupon on top
  const pkg = await seedPackage({ service, sessions: 5, totalPrice: 12000 });
  const customerEmail = `tutorial-pkg-referral-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Milica", lastName: "Stanković" });
  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  const { default: User } = await import("../../src/models/user.model.js");
  const customer = await User.findOne({ email: customerEmail });

  // --- admin: assigns the package with the partner's coupon ---
  const adminEmail = `tutorial-pkg-referral-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Katalog", itemLabel: "Kupljeni paketi", stepIdPrefix: "admin-paketi", mobile });
  await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Dodeli paket", stepIdPrefix: "admin-paketi" });

  await tut.step("admin-dodeljuje-paket-sa-kuponom", async () => {
    await selectOptionVisibly(adminPage.locator('select[name="userId"]'), customer._id.toString());
    await selectOptionVisibly(adminPage.locator('select[name="packageId"]'), pkg._id.toString());
    await typeSlowly(adminPage.locator('input[name="couponCode"]'), coupon.code);
    await clickVisibly(adminPage.getByRole("button", { name: "Dodeli paket" }), { mobile });
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  const { default: PackagePurchase } = await import("../../src/models/package-purchase.model.js");
  const purchase = await PackagePurchase.findOne({ user: customer._id });
  expect(purchase.originalPrice).toBe(12000);
  expect(purchase.discountApplied).toBe(1200); // 10% of 12000
  expect(purchase.pricePaid).toBe(10800); // what was really charged

  // the partner's commission is on pricePaid directly, no pro-rating
  await expect
    .poll(async () => (await CommissionEntry.find({ packagePurchase: purchase._id }).lean()).length, { timeout: 10_000 })
    .toBe(1);
  const [partnerEntry] = await CommissionEntry.find({ packagePurchase: purchase._id }).lean();
  expect(partnerEntry.earnerType).toBe("partner");
  expect(partnerEntry.baseValue).toBe(10800);
  expect(partnerEntry.amount).toBe(2160); // 10800 * 20%

  // --- customer: books a session paid from the package ---
  await bookServiceViaNav(page, tut, { mobile, service });
  await tut.step("klijent-rezervise-seansu", async () => {
    await expect(page.locator("#usePackagePurchase")).toBeChecked();
    await typeSlowly(page.locator("#booking-phone"), "0601234567");
    await clickVisibly(page.getByRole("button", { name: "Potvrdi zakazivanje" }), { mobile });
    await expect(page.getByRole("heading", { name: "Termin je uspešno zakazan!" })).toBeVisible();
  });

  const { default: Appointment } = await import("../../src/models/appointment.model.js");
  const appointment = await Appointment.findOne({ user: customer._id }).sort({ createdAt: -1 });
  expect(appointment.finalPrice).toBe(0);

  // --- admin: confirms then completes - this calculates the employee's commission ---
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
    .poll(async () => (await CommissionEntry.find({ appointment: appointment._id }).lean()).length, { timeout: 10_000 })
    .toBe(1);
  const [employeeEntry] = await CommissionEntry.find({ appointment: appointment._id }).lean();
  expect(employeeEntry.earnerType).toBe("employee");
  // KEY CHECK: 3000 * (10800 paid / 15000 true value) = 2160 - the coupon discount AND the package's
  // built-in discount combine into ONE ratio (0.72), not just one of them
  expect(employeeEntry.baseValue).toBe(2160);
  expect(employeeEntry.rate).toBe(10);
  // 2160 * 10% = 216, but a package session has a guaranteed minimum (site setting
  // "minimumSessionCommission", 500 by default) - the entry is the HIGHER of the two. The regression
  // test zeroes the floor to isolate the ratio; the tutorial leaves the default to show reality.
  expect(employeeEntry.amount).toBe(Math.max(216, 500));

  await finalizeAdminVideo();
}
