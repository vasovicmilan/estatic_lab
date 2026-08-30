import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { seedCustomer, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Partner from "../../../src/models/partner.model.js";
import Coupon from "../../../src/models/coupon.model.js";

/**
 * Tutorial scenario, not a regression test - shows the admin/back-office side of
 * the app for the first time in this tutorial set: setting up a NEW partner
 * account and a referral coupon for them, not just processing something a
 * customer already did. A partner is always promoted from an EXISTING user
 * account (partner.presenter.js's userId select - there's no "create a brand new
 * person" path here, only "this existing customer is now also a partner"), so
 * the customer account is seeded first. The coupon step then links back to the
 * partner via the coupon form's own "Referalni partner" field - the same
 * mechanism provizija-partnera-za-rezervaciju's referral commission depends on.
 */
test.describe("Tutorial: kreiranje partnera i kupona za njega", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin promoviše postojećeg korisnika u partnera, pa mu kreira referalni kupon", async ({ page, tut }) => {
    const futurePartner = await seedCustomer({ email: `tutorial-buduci-partner-${Date.now()}@example.com` });
    const couponCode = `DOBRODOSLI${Date.now()}`;

    const adminEmail = `tutorial-partner-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Partnerski program", itemLabel: "Partneri", stepIdPrefix: "admin-partneri" });
    await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi partner", stepIdPrefix: "admin-partneri" });

    await tut.step("izbor-korisnika", async () => {
      await page.locator('select[name="userId"]').selectOption({ value: futurePartner._id.toString() });
    });

    await tut.step("unos-provizija", async () => {
      // namerno različite stope za usluge i artikle - katalog ide od sitnog
      // potrošnog materijala do skupih uređaja, ista % stopa retko ima smisla
      // za oboje (videti partner.presenter.js-ovu napomenu uz ovo polje)
      await typeSlowly(page.locator('input[name="commissionRateServices"]'), "15");
      await typeSlowly(page.locator('input[name="commissionRateProducts"]'), "8");
    });

    await tut.step("cuvanje-partnera", async () => {
      await page.locator("[data-submit-btn]").click();
      await expectFlashSuccess(page);
    });

    const partner = await Partner.findOne({ userId: futurePartner._id });
    expect(partner).toBeTruthy();
    expect(partner.commissionRateServices).toBe(15);
    expect(partner.commissionRateProducts).toBe(8);

    // --- kreiranje referalnog kupona za novog partnera ---
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Kuponi", stepIdPrefix: "admin-kuponi" });
    await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi kupon", stepIdPrefix: "admin-kuponi" });

    await tut.step("unos-koda-kupona", async () => {
      await typeSlowly(page.locator('input[name="code"]'), couponCode);
    });

    await tut.step("unos-popusta", async () => {
      await page.locator('select[name="discountType"]').selectOption("percentage");
      await typeSlowly(page.locator('input[name="discountValue"]'), "10");
    });

    await tut.step("vezivanje-za-partnera", async () => {
      // ovo je ono što kupon čini REFERALNIM - svako korišćenje generiše
      // proviziju za ovog partnera, po stopi sa njegovog profila
      await page.locator('select[name="partner"]').selectOption({ value: partner._id.toString() });
    });

    await tut.step("cuvanje-kupona", async () => {
      await page.locator("[data-submit-btn]").click();
      await expectFlashSuccess(page);
    });

    const coupon = await Coupon.findOne({ code: couponCode });
    expect(coupon).toBeTruthy();
    expect(coupon.partner.toString()).toBe(partner._id.toString());
  });
});
