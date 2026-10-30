import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { seedCustomer, seedService } from "../../test/e2e/helpers/e2e-helpers.js";
import Employee from "../../src/models/employee.model.js";

/**
 * Shared flow of "zaposleni-dodavanje" / "-mobilni" - the admin turns an existing user account
 * into an employee: the services they perform, how they are paid, and where the SrediMe calendar
 * link goes (shown, not filled: a real link would start syncing).
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const service = await seedService({ price: 3000, duration: 45 });
  const person = await seedCustomer({ email: `tutorial-novi-zaposleni-${suffix}@example.com` });
  const adminEmail = `tutorial-zaposleni-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Tim", itemLabel: "Zaposleni", stepIdPrefix: "admin-zaposleni", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi zaposleni", stepIdPrefix: "admin-zaposleni" });

  await tut.step("zaposleni-korisnik", async () => {
    await selectOptionVisibly(page.locator('select[name="userId"]'), { value: person._id.toString() });
  });

  await tut.step("zaposleni-usluge", async () => {
    const box = page.locator('[data-multiselect-name="services"]');
    await highlight(box);
    await box.locator("[data-multiselect-source]").selectOption({ value: service._id.toString() });
    await clickVisibly(box.locator("[data-multiselect-add]"), { mobile });
  });

  await tut.step("zaposleni-isplata", async () => {
    await selectOptionVisibly(page.locator('select[name="payType"]'), "commission");
    const rate = page.locator('input[name="commissionRate"]');
    await highlight(rate);
    await rate.fill("25");
  });

  await tut.step("zaposleni-sredime", async () => {
    await highlight(page.locator('input[name="sredimeIcsUrl"]'));
  });

  await tut.step("zaposleni-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const employee = await Employee.findOne({ userId: person._id });
  expect(employee).toBeTruthy();
  expect(employee.payType).toBe("commission");
  expect(employee.commissionRate).toBe(25);
}
