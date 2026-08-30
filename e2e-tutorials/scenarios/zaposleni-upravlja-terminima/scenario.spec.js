import { test, expect } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedAppointment, findCommissionEntriesForAppointment, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * employee-appointment-management.spec.js. A completely separate self-service
 * area (/moj-nalog) from the admin panel already shown in zakazivanje-termina -
 * worth its own tutorial because it's the part a hired therapist/staff member
 * actually lives in day to day: their own schedule, confirming/completing their
 * own appointments, and seeing their own earned commission - without ever
 * touching the admin panel.
 */
test.describe("Tutorial: zaposleni upravlja svojim terminima", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni potvrđuje i završava sopstveni termin, i vidi zarađenu proviziju", async ({ page, tut }) => {
    const service = await seedService({ price: 3500, duration: 45 });
    const { user: employeeUser, employee } = await seedEmployee({ service, commissionRate: 30 });
    const appointment = await seedAppointment({ service, employeeRecord: employee, employeeUser, status: "pending" });

    await tut.step("prijava-zaposlenog", async () => {
      await loginViaUISlowly(page, { email: employeeUser.email });
    });

    await tut.step("pregled-mojih-termina", async () => {
      await page.goto("/moj-nalog/termini");
      await expect(page.getByText("Standard")).toBeVisible();
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

    // appointment:status_changed's commission-recording listener runs
    // asynchronously after the HTTP response (see commission.listener.js) - the
    // UI already shows success, but the commission entry itself lands a moment
    // later, so this poll (not itself narrated - nothing new is visible on
    // screen while it waits) exists purely to make the NEXT step reliable, not
    // to demonstrate anything to a viewer.
    await expect
      .poll(async () => {
        const entries = await findCommissionEntriesForAppointment(appointment._id);
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    await tut.step("pregled-provizije", async () => {
      await page.goto("/moj-nalog/provizije");
      // rendered twice (mobile card list + desktop table, one hidden per viewport
      // via Bootstrap's d-lg-none/d-none-d-lg-block) - scoping to the table cell
      // role specifically hits only the visible desktop copy
      await expect(page.getByRole("cell", { name: "30%" })).toBeVisible();
    });
  });
});
