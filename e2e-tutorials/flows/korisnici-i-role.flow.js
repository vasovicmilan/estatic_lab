import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { seedCustomer } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "korisnici-i-role" / "-mobilni" - a read-only tour of the people side: finding a
 * user account by email in "Korisnici", then the roles and what each one may do in "Role".
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const customerEmail = `tutorial-korisnik-${suffix}@example.com`;
  await seedCustomer({ email: customerEmail });
  const adminEmail = `tutorial-korisnici-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Tim", itemLabel: "Korisnici", stepIdPrefix: "admin-korisnici", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: customerEmail, stepIdPrefix: "admin-korisnici", mobile });

  await tut.step("korisnik-detalji", async () => {
    await expect(page.getByText(customerEmail).first()).toBeVisible();
    await scrollToSmoothly(page.locator("main").locator("h1, h2, h3, h4").last());
    await scrollToTop(page);
  });

  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sistem", itemLabel: "Role", stepIdPrefix: "admin-role", mobile });

  await tut.step("role-pregled", async () => {
    await expect(page).toHaveURL(/\/admin\/role/);
    await expect(page.locator("main")).toBeVisible();
  });
}
