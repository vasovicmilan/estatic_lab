import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { seedService, seedEmployee, seedCustomer, seedAppointment, confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";
import Appointment from "../../src/models/appointment.model.js";

/**
 * Shared flow of "termini-obrada" / "-mobilni" - an admin handles a booked appointment:
 * confirms it, hands it to another therapist, marks it done.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const lastName = `Termin${suffix}`;
  const service = await seedService({ price: 3500, duration: 45 });
  const { employee: first, user: firstUser } = await seedEmployee({ service });
  const { employee: second } = await seedEmployee({ service });
  const customer = await seedCustomer({ email: `tutorial-termini-${suffix}@example.com` });
  customer.lastName = lastName;
  await customer.save();
  const appointment = await seedAppointment({ service, employeeRecord: first, employeeUser: firstUser, status: "pending", customer, daysAhead: 2 });

  const adminEmail = `tutorial-termini-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: lastName, stepIdPrefix: "admin-termini", mobile });

  await tut.step("termin-pregled", async () => {
    await expect(page.getByRole("button", { name: "Potvrdi termin" })).toBeVisible();
    await highlight(page.getByRole("button", { name: "Potvrdi termin" }));
  });
  await tut.step("termin-potvrda", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi termin" }), { mobile });
    await confirmActionModal(page);
    await page.waitForLoadState("networkidle");
    await expectFlashSuccess(page);
  });
  await tut.step("termin-preraspodela", async () => {
    const select = page.locator("#assignEmployeeSelect");
    await scrollToSmoothly(select);
    await selectOptionVisibly(select, second._id.toString());
    await clickVisibly(page.getByRole("button", { name: "Promeni" }), { mobile });
    await expectFlashSuccess(page);
  });
  await tut.step("termin-zavrsetak", async () => {
    const done = page.getByRole("button", { name: "Označi kao završen" });
    await scrollToSmoothly(done);
    await clickVisibly(done, { mobile });
    await confirmActionModal(page);
    await page.waitForLoadState("networkidle");
    await expectFlashSuccess(page);
  });

  const updated = await Appointment.findById(appointment._id);
  expect(updated.status).toBe("completed");
  expect(updated.employee.toString()).toBe(second._id.toString());
}
