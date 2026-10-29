import { expect } from "../scripts/tutorial.fixture.js";
import { seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, searchAndOpenAdminRecord, selectOptionVisibly, clickVisibly } from "../scripts/slow-actions.js";
import { seedService, seedEmployee, seedAppointment, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "premestanje-termina" / "-mobilni". An admin moves an appointment to another
 * employee; an employee who is already busy at that time is not offered as an option. Admin only,
 * one actor. The appointment is seeded; the admin finds it through the menu and search, changes the
 * employee, then opens it again to show the busy employee is no longer in the list.
 */
export async function run({ page, tut, mobile }) {
  const service = await seedService({ price: 3000, duration: 30 });
  const { employee: employeeA, user: userA } = await seedEmployee({ service });
  const { employee: employeeB, user: userB } = await seedEmployee({ service });
  const { employee: employeeC } = await seedEmployee({ service });

  const appointment = await seedAppointment({ service, employeeRecord: employeeA, employeeUser: userA, status: "confirmed", daysAhead: 2 });
  // employee B has their own appointment at the same time - so B is "busy" and must not be offered
  await seedAppointment({ service, employeeRecord: employeeB, employeeUser: userB, status: "confirmed", daysAhead: 2 });

  const adminEmail = `tutorial-reassign-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: appointment.contactSnapshot.email, stepIdPrefix: "admin-termini", mobile });
  await expect(page.locator("#assignEmployeeSelect")).toBeVisible();

  await tut.step("premestanje-na-slobodnog", async () => {
    await selectOptionVisibly(page.locator("#assignEmployeeSelect"), employeeC._id.toString());
    await clickVisibly(page.getByRole("button", { name: "Promeni" }), { mobile });
    await expectFlashSuccess(page);
  });

  const { default: Appointment } = await import("../../src/models/appointment.model.js");
  const updated = await Appointment.findById(appointment._id);
  expect(updated.employee.toString()).toBe(employeeC._id.toString());

  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-ponovo", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: appointment.contactSnapshot.email, stepIdPrefix: "admin-ponovo", mobile });

  await tut.step("zauzet-zaposleni-nije-ponudjen", async () => {
    await expect(page.locator(`#assignEmployeeSelect option[value="${employeeB._id.toString()}"]`)).toHaveCount(0);
    await expect(page.locator(`#assignEmployeeSelect option[value="${employeeA._id.toString()}"]`)).toHaveCount(1);
  });
}
