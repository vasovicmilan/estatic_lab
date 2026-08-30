import { test, expect } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { setEmployeeWorkingHoursViaUISlowly, loginViaUISlowly } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, expectFlashSuccess, tomorrowInBelgrade } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * employee-working-hours.spec.js's first case (empty -> populated working hours).
 * Narrated as an admin/staff-setup demo: a service with no available slots until
 * an employee sets their working hours, then the same booking page immediately
 * reflecting that change - the direct cause-and-effect a client asks about most
 * ("why don't I see any slots?").
 */
test.describe("Tutorial: radno vreme zaposlenog", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni podešava radno vreme, termini se odmah pojavljuju za rezervaciju", async ({ page, tut }) => {
    const service = await seedService({ price: 2000, duration: 30 });
    const { user: employeeUser } = await seedEmployee({ service, workingHours: [] });
    const { iso: tomorrowIso, weekday: tomorrowDay } = tomorrowInBelgrade();
    const slotsUrl = `/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`;

    await tut.step("bez-radnog-vremena-nema-termina", async () => {
      await page.goto(slotsUrl);
      await expect(page.getByText("Nema dostupnih termina za izabrani datum.")).toBeVisible();
    });

    await tut.step("prijava-zaposlenog", async () => {
      await loginViaUISlowly(page, { email: employeeUser.email });
    });

    await tut.step("otvaranje-profila", async () => {
      await page.goto("/moj-nalog/profil");
      await expect(page.locator(`[data-schedule-day="${tomorrowDay}"]`)).toBeVisible();
    });

    await tut.step("dodavanje-radnog-vremena", async () => {
      await setEmployeeWorkingHoursViaUISlowly(page, tomorrowDay, [{ from: "09:00", to: "17:00" }]);
    });

    await tut.step("cuvanje-radnog-vremena", async () => {
      await page.getByRole("button", { name: "Sačuvaj radno vreme" }).click();
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
