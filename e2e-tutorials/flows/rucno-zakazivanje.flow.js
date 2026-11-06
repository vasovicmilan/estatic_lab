import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { seedService, seedEmployee, tomorrowInBelgrade } from "../../test/e2e/helpers/e2e-helpers.js";
import Appointment from "../../src/models/appointment.model.js";

/**
 * Shared flow of "rucno-zakazivanje" / "-mobilni" - an admin books an appointment by hand
 * for a client who phoned or walked in: service, variant, therapist, time and contact.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const clientEmail = `tutorial-rucno-${suffix}@example.com`;
  const service = await seedService({ price: 4000, duration: 45 });
  const { employee } = await seedEmployee({ service });
  const adminEmail = `tutorial-rucno-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Termini", stepIdPrefix: "admin-termini", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi termin (ručno)", stepIdPrefix: "admin-termini" });

  await tut.step("rucno-usluga", async () => {
    await selectOptionVisibly(page.locator("#serviceId"), service._id.toString());
    await expect(page.locator("#servicePackageId")).toBeEnabled();
    await selectOptionVisibly(page.locator("#servicePackageId"), { index: 1 });
  });
  await tut.step("rucno-terapeut", async () => {
    await expect(page.locator("#employeeId")).toBeEnabled();
    await selectOptionVisibly(page.locator("#employeeId"), employee._id.toString());
  });
  await tut.step("rucno-vreme", async () => {
    const start = page.locator("#startTime");
    await highlight(start);
    await start.fill(`${tomorrowInBelgrade().iso}T11:00`);
  });
  await tut.step("rucno-klijent", async () => {
    await typeSlowly(page.locator("#firstName"), "Milica");
    await typeSlowly(page.locator("#lastName"), "Stanković");
    await typeSlowly(page.locator("#email"), clientEmail);
    await typeSlowly(page.locator("#phone"), "0641234567");
  });
  await tut.step("rucno-napomena", async () => {
    await typeSlowly(page.locator("#note"), "Zakazano telefonom.");
  });
  await tut.step("rucno-cuvanje", async () => {
    const submit = page.getByRole("button", { name: "Kreiraj termin" });
    await scrollToSmoothly(submit);
    await clickVisibly(submit, { mobile });
    await expectFlashSuccess(page);
  });

  const created = await Appointment.findOne({ "contactSnapshot.email": clientEmail });
  expect(created).toBeTruthy();
  expect(created.employee.toString()).toBe(employee._id.toString());
}
