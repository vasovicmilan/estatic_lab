import { test, expect } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedService, seedEmployee, seedAppointment, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * appointment-reassign.spec.js. Worth its own tutorial specifically for what it
 * DOESN'T show as much as what it does: the "assign to" dropdown is pre-filtered
 * server-side to only employees who'd actually pass the working-hours/overlap
 * checks (appointment.controller.js's eligibleIds, availability.service.js's
 * getEligibleEmployeeIdsForAppointment) - an already double-booked employee is
 * never offered as a selectable option at all, rather than being selectable and
 * then rejected after the fact. That's a real, demo-worthy piece of business
 * logic quality, not just a plain CRUD dropdown.
 */
test.describe("Tutorial: premeštanje termina", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin premešta termin na slobodnog zaposlenog; već zauzet zaposleni se ne nudi kao opcija", async ({ page, tut }) => {
    const service = await seedService({ price: 3000, duration: 30 });
    const { employee: employeeA, user: userA } = await seedEmployee({ service });
    const { employee: employeeB, user: userB } = await seedEmployee({ service });
    const { employee: employeeC } = await seedEmployee({ service });

    const appointment = await seedAppointment({ service, employeeRecord: employeeA, employeeUser: userA, status: "confirmed", daysAhead: 2 });
    // zaposleni B već ima nešto drugo zakazano u TAČNO isto vreme - baš ono što
    // filtriranje niže treba da uhvati
    await seedAppointment({ service, employeeRecord: employeeB, employeeUser: userB, status: "confirmed", daysAhead: 2 });

    const adminEmail = `tutorial-reassign-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini" });
    await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: appointment.contactSnapshot.email, stepIdPrefix: "admin-termini" });
    await expect(page.locator("#assignEmployeeSelect")).toBeVisible();

    await tut.step("premestanje-na-slobodnog", async () => {
      await page.locator("#assignEmployeeSelect").selectOption(employeeC._id.toString());
      await page.getByRole("button", { name: "Promeni" }).click();
      await expectFlashSuccess(page);
    });

    const { default: Appointment } = await import("../../../src/models/appointment.model.js");
    const updated = await Appointment.findById(appointment._id);
    expect(updated.employee.toString()).toBe(employeeC._id.toString());

    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-ponovo" });
    await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: appointment.contactSnapshot.email, stepIdPrefix: "admin-ponovo" });

    await tut.step("zauzet-zaposleni-nije-ponudjen", async () => {
      await expect(page.locator(`#assignEmployeeSelect option[value="${employeeB._id.toString()}"]`)).toHaveCount(0);
      // zaposleni A (originalni, sad opet slobodan pošto je termin prešao na C)
      // treba i dalje da bude ponuđen
      await expect(page.locator(`#assignEmployeeSelect option[value="${employeeA._id.toString()}"]`)).toHaveCount(1);
    });
  });
});
