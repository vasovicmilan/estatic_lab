import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import Resource from "../../src/models/resource.model.js";

/**
 * Shared flow of "kreiranje-resursa" / "-mobilni" - an admin adds a resource (a device or a
 * treatment table) that appointments reserve. Every step is a click through the real menus.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const resourceName = `Aparat za mezoterapiju ${suffix}`;
  const adminEmail = `tutorial-resurs-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Zakazivanje", itemLabel: "Resursi", stepIdPrefix: "admin-resursi", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi resurs", stepIdPrefix: "admin-resursi" });

  await tut.step("unos-naziva", async () => {
    await typeSlowly(page.locator('input[name="name"]'), resourceName);
  });

  await tut.step("unos-kapaciteta", async () => {
    // the field starts with "1"; .fill() replaces it instead of appending
    await highlight(page.locator('input[name="capacity"]'));
    await page.locator('input[name="capacity"]').fill("2");
  });

  await tut.step("unos-napomene", async () => {
    await typeSlowly(page.locator('textarea[name="notes"]'), "Dva aparata istog tipa, mogu se koristiti istovremeno.");
  });

  await tut.step("cuvanje-resursa", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const resource = await Resource.findOne({ name: resourceName });
  expect(resource).toBeTruthy();
  expect(resource.capacity).toBe(2);
}
