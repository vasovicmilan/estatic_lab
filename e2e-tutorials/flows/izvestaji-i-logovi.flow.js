import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Shared flow of "izvestaji-i-logovi" / "-mobilni" - a read-only tour of the two places an owner
 * looks at to understand the business and the system: business reports and the logs.
 */
export async function run({ page, tut, mobile }) {
  const adminEmail = `tutorial-izvestaji-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Poslovni izveštaji", itemLabel: "Pregled", stepIdPrefix: "admin-izvestaji", mobile });

  await tut.step("izvestaji-pregled", async () => {
    await expect(page).toHaveURL(/\/admin\/poslovni-izvestaji/);
    await expect(page.locator("main")).toBeVisible();
    await scrollToSmoothly(page.locator("main").locator("h1, h2, h3").last());
    await scrollToTop(page);
  });

  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sistem", itemLabel: "Logovi", stepIdPrefix: "admin-logovi", mobile });

  await tut.step("logovi-pregled", async () => {
    await expect(page).toHaveURL(/\/admin\/logovi/);
    await expect(page.locator("main")).toBeVisible();
    await scrollToSmoothly(page.locator("main").locator("h1, h2, h3").last());
    await scrollToTop(page);
  });
}
