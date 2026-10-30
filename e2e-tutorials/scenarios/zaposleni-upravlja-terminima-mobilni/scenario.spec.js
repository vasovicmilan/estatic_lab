import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import {
  loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu,
  goToLoginViaNav, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab,
  scrollToSmoothly, scrollToTop, visibleText, visibleStatus, setEmployeeWorkingHoursViaUISlowly,
} from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedAppointment, findCommissionEntriesForAppointment, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario (telefon, 390x844 portrait) - an employee confirms and completes their own
 * appointment and sees the earned commission. Same story as the computer version.
 */
const MOBILE = true;

test.describe("Tutorial: zaposleni upravlja svojim terminima (telefon)", () => {
  test.use({ tutorialDevice: "mobile" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni potvrđuje i završava sopstveni termin, i vidi zarađenu proviziju", async ({ page, tut }) => {
    test.slow();

    const service = await seedService({ price: 3500, duration: 45 });
    const { user: employeeUser, employee } = await seedEmployee({ service, commissionRate: 30 });
    const appointment = await seedAppointment({ service, employeeRecord: employee, employeeUser, status: "pending" });

    await tut.step("otvaranje-pocetne", async () => {
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
    });

    await goToLoginViaNav(page, tut, { mobile: MOBILE, stepIdPrefix: "login" });

    await tut.step("unos-prijave", async () => {
      await fillLoginFormSlowly(page, { email: employeeUser.email });
    });

    await openAccountMenuItem(page, tut, { mobile: MOBILE, href: "/moj-nalog", stepIdPrefix: "portal" });

    await tut.step("pregled-mojih-termina", async () => {
      await clickPortalTab(page, { mobile: MOBILE, label: "Termini" });
      await expect(visibleText(page, "Standard")).toBeVisible();
    });

    await tut.step("otvaranje-detalja-termina", async () => {
      await page.goto(`/moj-nalog/termini/detalji/${appointment._id.toString()}`);
      await expect(page.getByRole("button", { name: "Potvrdi" })).toBeVisible();
    });

    await tut.step("potvrda-termina", async () => {
      await page.getByRole("button", { name: "Potvrdi" }).click();
      await expectFlashSuccess(page);
    });

    await tut.step("zavrsavanje-termina", async () => {
      await page.getByRole("button", { name: "Označi kao završen" }).click();
      await expectFlashSuccess(page);
    });

    // provizija se upisuje asinhrono posle odgovora (commission.listener.js) - ovaj poll
    // nije deo priče, samo čini sledeći korak pouzdanim
    await expect
      .poll(async () => (await findCommissionEntriesForAppointment(appointment._id)).length, { timeout: 10_000 })
      .toBe(1);

    await tut.step("pregled-provizije", async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile: MOBILE, label: "Provizija" });
      await expect(visibleText(page, "30%")).toBeVisible();
    });
  });
});
