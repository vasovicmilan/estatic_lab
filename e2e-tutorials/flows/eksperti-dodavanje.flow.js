import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { clickMainNavLink } from "../scripts/slow-actions.js";
import Expert from "../../src/models/expert.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../fixtures/placeholder.jpg");

/**
 * Shared flow of "eksperti-dodavanje" / "-mobilni" - the admin adds a team member to "Eksperti",
 * who then appears on the public "Naš tim" page.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const lastName = `Ilić${suffix}`;
  const adminEmail = `tutorial-ekspert-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Tim", itemLabel: "Eksperti", stepIdPrefix: "admin-eksperti", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi ekspert", stepIdPrefix: "admin-eksperti" });

  await tut.step("ekspert-ime", async () => {
    await typeSlowly(page.locator('input[name="firstName"]'), "Marija");
    await typeSlowly(page.locator('input[name="lastName"]'), lastName);
  });
  await tut.step("ekspert-titula", async () => {
    await typeSlowly(page.locator('input[name="title"]'), "Senior terapeut");
    await typeSlowly(page.locator('textarea[name="shortBio"]'), "Petnaest godina iskustva u masaži i nezi lica.");
  });
  await tut.step("ekspert-slika", async () => {
    await uploadFileVisibly(page.locator('input[name="expertImage"]'), PLACEHOLDER_IMAGE);
    await typeSlowly(page.locator('input[name="imageDesc"]'), "Marija - senior terapeut");
  });
  await tut.step("ekspert-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const expert = await Expert.findOne({ lastName });
  expect(expert).toBeTruthy();

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await clickMainNavLink(page, tut, { mobile, href: "/nas-tim", id: "nav-nas-tim" });
  await tut.step("ekspert-na-sajtu", async () => {
    await expect(page.getByText(lastName).first()).toBeVisible();
  });
}
