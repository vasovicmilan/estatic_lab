import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import {
  loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu,
  goToLoginViaNav, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab,
  scrollToSmoothly, scrollToTop, visibleText, visibleStatus, setEmployeeWorkingHoursViaUISlowly,
} from "../../scripts/slow-actions.js";
import { seedEmployee, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import PayoutRequest from "../../../src/models/payout-request.model.js";

/**
 * Tutorial scenario (telefon, 390x844 portrait) - employee payout, from request to paid.
 * Same story as its sibling scenario for the computer; only the layout differs: the menu is
 * behind the burger button and the portal tabs are the fixed bottom bar.
 */
const MOBILE = true;

test.describe("Tutorial: isplata zaposlenom (telefon)", () => {
  test.use({ tutorialDevice: "mobile" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni traži isplatu, admin je odobrava pa označava kao isplaćenu", async ({ page, browser, tut }) => {
    test.slow();

    const { user: employeeUser, employee } = await seedEmployee({ commissionRate: 20 });
    await seedCommissionEntry({ earnerType: "employee", employee, amount: 3000, rate: 20 });

    await tut.step("otvaranje-pocetne", async () => {
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
    });

    await goToLoginViaNav(page, tut, { mobile: MOBILE, stepIdPrefix: "login" });

    await tut.step("unos-prijave", async () => {
      await fillLoginFormSlowly(page, { email: employeeUser.email });
    });

    await openAccountMenuItem(page, tut, { mobile: MOBILE, href: "/moj-nalog", stepIdPrefix: "portal" });

    await tut.step("pregled-stanja", async () => {
      await scrollToSmoothly(page.locator('input[name="amount"]'));
      await expect(visibleText(page, "3000")).toBeVisible();
    });

    await tut.step("zahtev-za-isplatu", async () => {
      const amount = page.locator('input[name="amount"]');
      await scrollToSmoothly(amount);
      await typeSlowly(amount, "2000");
      await page.getByRole("button", { name: "Pošalji zahtev" }).click();
      await expectFlashSuccess(page);
    });

    const request = await PayoutRequest.findOne({ employee: employee._id }).sort({ createdAt: -1 });
    expect(request.status).toBe("requested");
    expect(request.amount).toBe(2000);

    await tut.step("preostalo-stanje", async () => {
      // 3000 zarađeno - 2000 rezervisano = 1000 preostalo; forma sama ograničava (max atribut)
      await scrollToSmoothly(page.locator('input[name="amount"]'));
      await expect(page.locator('input[name="amount"]')).toHaveAttribute("max", "1000");
    });

    await tut.step("tab-isplate", async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile: MOBILE, label: "Isplate" });
      await expect(visibleStatus(page, "Zatraženo")).toBeVisible();
    });

    await tut.step("zahtev-na-cekanju", async () => {
      await expect(visibleStatus(page, "Zatraženo")).toBeVisible();
    });

    // --- admin: odobrava pa označava kao isplaćeno ---
    const adminEmail = `tutorial-payout-admin-m-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
      browser, "isplata-zaposlenom-mobilni", "admin-flow", "Administrator", { device: "mobile" }
    );
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak", mobile: MOBILE });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Partnerski program", itemLabel: "Isplate", stepIdPrefix: "admin-isplate", mobile: MOBILE });

    await tut.step("admin-otvara-zahtev", async () => {
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

    await finalizeAdminVideo();
  });
});
