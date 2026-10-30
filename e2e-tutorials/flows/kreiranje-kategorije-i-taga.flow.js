import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import Category from "../../src/models/category.model.js";
import Tag from "../../src/models/tag.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../fixtures/placeholder.jpg");

/**
 * Shared flow of "kreiranje-kategorije-i-taga" / "-mobilni" - the two ways an admin groups the
 * catalog: a category (with a required image) and a tag. All through the menus.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const categoryName = `Tretmani lica ${suffix}`;
  const tagName = `Anti-age ${suffix}`;
  const adminEmail = `tutorial-kategorija-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Katalog", itemLabel: "Kategorije", stepIdPrefix: "admin-kategorije", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Nova kategorija", stepIdPrefix: "admin-kategorije" });

  await tut.step("kategorija-naziv", async () => {
    await typeSlowly(page.locator('input[name="name"]'), categoryName);
  });

  await tut.step("kategorija-domen", async () => {
    await selectOptionVisibly(page.locator('select[name="domain"]'), "service");
  });

  await tut.step("kategorija-opis", async () => {
    await typeSlowly(page.locator('textarea[name="shortDescription"]'), "Nega i podmlađivanje kože lica.");
  });

  await tut.step("kategorija-slika", async () => {
    await uploadFileVisibly(page.locator('input[name="categoryImage"]'), PLACEHOLDER_IMAGE);
    await typeSlowly(page.locator('input[name="categoryImageDesc"]'), "Tretman lica - naslovna slika");
  });

  await tut.step("kategorija-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const category = await Category.findOne({ name: categoryName });
  expect(category).toBeTruthy();
  expect(category.domain).toBe("service");

  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Katalog", itemLabel: "Tagovi", stepIdPrefix: "admin-tagovi", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi tag", stepIdPrefix: "admin-tagovi" });

  await tut.step("tag-naziv", async () => {
    await typeSlowly(page.locator('input[name="name"]'), tagName);
  });

  await tut.step("tag-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const tag = await Tag.findOne({ name: tagName });
  expect(tag).toBeTruthy();
}
