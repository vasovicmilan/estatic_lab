import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  loginViaUI,
  seedService,
  seedEmployee,
  expectFlashSuccess,
  tomorrowInBelgrade,
  setEmployeeWorkingHoursViaUI,
} from "./helpers/e2e-helpers.js";
import Employee from "../../src/models/employee.model.js";

/**
 * End-to-end coverage for an employee changing their own working hours through
 * /moj-nalog/profil, and the booking availability engine (availability.service.js /
 * working-hours.util.js) actually reacting to it - never exercised through a real
 * browser before this suite existed. Working hours are set via
 * setEmployeeWorkingHoursViaUI, which clicks through the real admin-schedule.js
 * widget (add/remove-slot buttons, from/to time inputs) rather than writing to its
 * hidden input directly - that widget re-serializes its own current UI state into
 * the hidden field on the form's submit event, which would silently overwrite any
 * value set by other means.
 *
 * Slot links are scoped via `a[href*="/podaci?"]`, not a shared CSS class like
 * .btn-outline-primary - that class is also used by navigation.ejs's own
 * "Registracija" link (shown to every logged-out visitor), which would otherwise
 * always count as one extra match regardless of actual slot availability.
 */
test.describe("Employee working hours - effect on booking availability", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("a day with no working hours shows no slots; adding hours for that day makes slots appear", async ({ page }) => {
    const service = await seedService({ price: 2000, duration: 30 });
    // starts with NO working hours at all - isEmployeeWorkingAt can never match,
    // so slot generation should come up empty regardless of which day is checked
    const { user: employeeUser, employee } = await seedEmployee({ service, workingHours: [] });

    const { iso: tomorrowIso, weekday: tomorrowDay } = tomorrowInBelgrade();

    await page.goto(`/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`);
    await expect(page.getByText("Nema dostupnih termina za izabrani datum.")).toBeVisible();
    await expect(page.locator('a[href*="/podaci?"]')).toHaveCount(0);

    // --- employee sets working hours covering tomorrow's weekday, all day ---
    await loginViaUI(page, { email: employeeUser.email });
    await page.goto("/moj-nalog/profil");

    await setEmployeeWorkingHoursViaUI(page, tomorrowDay, [{ from: "00:00", to: "23:59" }]);
    await page.getByRole("button", { name: "Sačuvaj radno vreme" }).click();
    await expectFlashSuccess(page);

    const updated = await Employee.findById(employee._id);
    expect(updated.workingHours).toHaveLength(1);
    expect(updated.workingHours[0].day).toBe(tomorrowDay);

    // --- the exact same slots page now shows real availability ---
    await page.goto(`/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`);
    await expect(page.getByText("Nema dostupnih termina za izabrani datum.")).toBeHidden();
    const slotCount = await page.locator('a[href*="/podaci?"]').count();
    expect(slotCount).toBeGreaterThan(0);
  });

  test("narrowing working hours to a single short window still only offers slots inside that window", async ({ page }) => {
    const service = await seedService({ price: 2000, duration: 30 });
    const { iso: tomorrowIso, weekday: tomorrowDay } = tomorrowInBelgrade();

    // only a 1-hour window (09:00-10:00), for a 30-minute service - room for
    // exactly one or two slots, not the wide-open all-day default other specs use
    const { user: employeeUser } = await seedEmployee({
      service,
      workingHours: [{ day: tomorrowDay, slots: [{ from: "09:00", to: "10:00" }] }],
    });

    await page.goto(`/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`);
    const slotLinks = page.locator('a[href*="/podaci?"]');
    await expect(slotLinks.first()).toBeVisible();
    await expect(slotLinks).toHaveCount(2); // 09:00 and 09:30, for a 30-min service in a 1h window
    await expect(page.getByText("18:00", { exact: true })).toBeHidden();

    // shrink the window even further, down to a single 30-minute slot
    await loginViaUI(page, { email: employeeUser.email });
    await page.goto("/moj-nalog/profil");
    await setEmployeeWorkingHoursViaUI(page, tomorrowDay, [{ from: "14:00", to: "14:30" }]);
    await page.getByRole("button", { name: "Sačuvaj radno vreme" }).click();
    await expectFlashSuccess(page);

    await page.goto(`/zakazivanje/${service.slug}/termin?servicePackageId=${service.packages[0]._id.toString()}&date=${tomorrowIso}`);
    await expect(slotLinks).toHaveCount(1);
    await expect(page.getByText("14:00", { exact: true })).toBeVisible();
  });
});