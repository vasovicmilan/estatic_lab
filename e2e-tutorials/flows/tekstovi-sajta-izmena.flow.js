import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { openMoreMenuLink } from "../scripts/slow-actions.js";

/**
 * Shared flow of "tekstovi-sajta-izmena" / "-mobilni" - the admin edits the "O nama" intro in
 * "Tekstovi sajta" and sees it on the public page at once (no code, no redeploy).
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const newIntro = `Estetik Lab je studio u kom se nega tela i lica radi bez žurbe. ${suffix}`;
  const adminEmail = `tutorial-tekstovi-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Tekstovi sajta", stepIdPrefix: "admin-tekstovi", mobile });

  await tut.step("tekstovi-izbor-teksta", async () => {
    await clickVisibly(page.locator('a.btn-primary[href$="/sadrzaj/o-nama"]'), { mobile });
    await expect(page.locator('textarea[name="intro"]')).toBeVisible();
  });

  await tut.step("tekstovi-izmena", async () => {
    const intro = page.locator('textarea[name="intro"]');
    await highlight(intro);
    await intro.fill(newIntro);
  });

  await tut.step("tekstovi-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]").first(), { mobile });
    await expectFlashSuccess(page);
  });

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await openMoreMenuLink(page, tut, { mobile, href: "/o-nama", id: "nav-o-nama" });
  await tut.step("tekstovi-javna-stranica", async () => {
    await expect(page.getByText(newIntro).first()).toBeVisible();
  });
}
