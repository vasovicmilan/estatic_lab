import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import {
  loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu,
  goToLoginViaNav, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab,
  scrollToSmoothly, scrollToTop, visibleText, visibleStatus,
} from "../../scripts/slow-actions.js";
import { seedPartner, seedCoupon, seedService, seedProduct, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import PayoutRequest from "../../../src/models/payout-request.model.js";

/**
 * Tutorial scenario (računar, 1920x1080) - partner payout, from request to paid. Every
 * navigation step is clicked through (home page -> login -> account menu -> tabs),
 * on BOTH sides: the partner's own screens and the admin's. 
 * Same story as its sibling scenario for the other device - only the layout differs.
 */
const MOBILE = false;

test.describe("Tutorial: isplata partneru", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("partner traži isplatu preko svog naloga, admin je odobrava pa označava kao isplaćenu", async ({ page, browser, tut }) => {
    test.slow();

    const { user: partnerUser, partner } = await seedPartner({ commissionRateServices: 10, commissionRateProducts: 5 });
    await seedCommissionEntry({ earnerType: "partner", partner, amount: 3000, rate: 10 });

    await tut.step("otvaranje-pocetne", async () => {
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
    });

    await goToLoginViaNav(page, tut, { mobile: MOBILE, stepIdPrefix: "login" });

    await tut.step("unos-prijave", async () => {
      await fillLoginFormSlowly(page, { email: partnerUser.email });
    });

    await openAccountMenuItem(page, tut, { mobile: MOBILE, href: "/moj-partner-nalog", stepIdPrefix: "portal" });

    await tut.step("pregled-stanja", async () => {
      await scrollToSmoothly(page.getByText("Raspoloživo za isplatu").first());
      await expect(visibleText(page, "3000")).toBeVisible();
    });

    await tut.step("zahtev-za-isplatu", async () => {
      const amount = page.locator('input[name="amount"]');
      await scrollToSmoothly(amount);
      await typeSlowly(amount, "2000");
      await page.getByRole("button", { name: "Pošalji zahtev" }).click();
      await expectFlashSuccess(page);
    });

    const request = await PayoutRequest.findOne({ partner: partner._id }).sort({ createdAt: -1 });
    expect(request.earnerType).toBe("partner");
    expect(request.status).toBe("requested");
    expect(request.amount).toBe(2000);

    await tut.step("rezervisano-i-preostalo", async () => {
      // 3000 zarađeno - 2000 rezervisano zahtevom = 1000 raspoloživo; forma sama
      // ne dozvoljava više od toga (max atribut). Strana je posle slanja ponovo
      // učitana, pa se ponovo prikazuju kartice stanja
      await scrollToTop(page);
      await expect(visibleText(page, "Rezervisano (na čekanju)")).toBeVisible();
      await scrollToSmoothly(visibleText(page, "Rezervisano (na čekanju)"));
      await expect(page.locator('input[name="amount"]')).toHaveAttribute("max", "1000");
    });

    await tut.step("tab-isplate", async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile: MOBILE, label: "Isplate" });
      await expect(page.getByRole("heading", { name: "Moje isplate" })).toBeVisible();
    });

    await tut.step("zahtev-na-cekanju", async () => {
      await expect(visibleStatus(page, "Zatraženo")).toBeVisible();
    });

    // --- admin: odobrava pa označava kao isplaćeno ---
    const adminEmail = `tutorial-partner-payout-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
      browser, "isplata-partneru", "admin-flow", "Administrator", { device: MOBILE ? "mobile" : "desktop" }
    );
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak", mobile: MOBILE });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Partnerski program", itemLabel: "Isplate", stepIdPrefix: "admin-isplate", mobile: MOBILE });

    await tut.step("admin-otvara-zahtev", async () => {
      // lista isplata je zajednička za zaposlene i partnere - da se otvori baš
      // ovaj zahtev (a ne neki iz prethodnog scenarija), ide se direktno na
      // njegove detalje, isto kao u regresionom testu
      await adminPage.goto(`/admin/isplate/detalji/${request._id.toString()}`);
      await expect(adminPage.getByRole("button", { name: "Odobri" })).toBeVisible();
    }, { page: adminPage, video: adminVideo });

    await tut.step("admin-odobrava", async () => {
      await adminPage.getByRole("button", { name: "Odobri" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const approved = await PayoutRequest.findById(request._id);
    expect(approved.status).toBe("approved");

    await tut.step("admin-oznacava-isplaceno", async () => {
      await adminPage.getByRole("button", { name: "Označi kao isplaćeno" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const paid = await PayoutRequest.findById(request._id);
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).toBeTruthy();

    await tut.step("istorija-isplata", async () => {
      // klik na već otvoren tab ponovo učitava stranu sa svežim statusom
      await clickPortalTab(page, { mobile: MOBILE, label: "Isplate" });
      await expect(visibleStatus(page, "Isplaćeno")).toBeVisible();
    });

    await tut.step("stanje-posle-isplate", async () => {
      await clickPortalTab(page, { mobile: MOBILE, label: "Pregled" });
      await expect(visibleText(page, "Isplaćeno")).toBeVisible();
      await expect(visibleText(page, "2000")).toBeVisible();
    });

    await finalizeAdminVideo();
  });
});
