import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import {
  loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu,
  goToLoginViaNav, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab,
  scrollToSmoothly, scrollToTop, visibleText, visibleStatus, setEmployeeWorkingHoursViaUISlowly,
} from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, expectFlashSuccess, tomorrowInBelgrade } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario (telefon, 390x844 portrait) - an employee sets working hours and the same
 * booking page immediately shows slots. Same story as the computer version; only the layout differs.
 */
const MOBILE = true;

test.describe("Tutorial: radno vreme zaposlenog (telefon)", () => {
  test.use({ tutorialDevice: "mobile" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni podešava radno vreme, termini se odmah pojavljuju za rezervaciju", async ({ page, tut }) => {
    test.slow();

    const service = await seedService({ price: 2000, duration: 30 });
    const { user: employeeUser } = await seedEmployee({ service, workingHours: [] });
    const { iso: tomorrowIso, weekday: tomorrowDay } = tomorrowInBelgrade();
    const slotsUrl = `/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`;

    await tut.step("bez-radnog-vremena-nema-termina", async () => {
      await page.goto(slotsUrl);
      await expect(page.getByText("Nema dostupnih termina za izabrani datum.")).toBeVisible();
    });

    await page.goto("/");
    await goToLoginViaNav(page, tut, { mobile: MOBILE, stepIdPrefix: "login" });

    await tut.step("unos-prijave", async () => {
      await fillLoginFormSlowly(page, { email: employeeUser.email });
    });

    await openAccountMenuItem(page, tut, { mobile: MOBILE, href: "/moj-nalog", stepIdPrefix: "portal" });

    await tut.step("otvaranje-profila", async () => {
      await clickPortalTab(page, { mobile: MOBILE, label: "Profil" });
      await expect(page.locator(`[data-schedule-day="${tomorrowDay}"]`)).toBeVisible();
      await scrollToSmoothly(page.locator(`[data-schedule-day="${tomorrowDay}"]`));
    });

    await tut.step("dodavanje-radnog-vremena", async () => {
      await setEmployeeWorkingHoursViaUISlowly(page, tomorrowDay, [{ from: "09:00", to: "17:00" }]);
    });

    await tut.step("cuvanje-radnog-vremena", async () => {
      const save = page.getByRole("button", { name: "Sačuvaj radno vreme" });
      await scrollToSmoothly(save);
      await save.click();
      await expectFlashSuccess(page);
    });

    await tut.step("termini-sada-dostupni", async () => {
      await page.goto(slotsUrl);
      await expect(page.getByText("Nema dostupnih termina za izabrani datum.")).toBeHidden();
      const slotCount = await page.locator('a[href*="/podaci?"]').count();
      expect(slotCount).toBeGreaterThan(0);
    });
  });
});
