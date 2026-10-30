import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../fixtures/placeholder.jpg");
import Service from "../../src/models/service.model.js";

/**
 * Shared flow of "kreiranje-usluge" / "-mobilni" - service creation is a 3-phase wizard
 * (basic data + image -> variants -> extras), each phase its own page load and POST.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const serviceName = `Higijenski tretman lica ${suffix}`;
  const adminEmail = `tutorial-usluga-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Katalog", itemLabel: "Usluge", stepIdPrefix: "admin-usluge", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Nova usluga", stepIdPrefix: "admin-usluge" });

  await tut.step("usluga-faza1-naziv", async () => {
    await typeSlowly(page.locator('input[name="name"]'), serviceName);
    await typeSlowly(page.locator('textarea[name="shortDescription"]'), "Dubinsko čišćenje i hidratacija lica za zdrav i odmoran ten.");
  });
  await tut.step("usluga-faza1-trajanje", async () => {
    const duration = page.locator('input[name="defaultDuration"]');
    await highlight(duration);
    await duration.fill("60");
  });
  await tut.step("usluga-faza1-slika", async () => {
    await uploadFileVisibly(page.locator('input[name="serviceImage"]'), PLACEHOLDER_IMAGE);
    await typeSlowly(page.locator('input[name="imageDesc"]'), "Higijenski tretman lica");
  });
  await tut.step("usluga-faza1-nastavak", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expect(page.getByText("Faza 2 od 3")).toBeVisible();
  });

  await tut.step("usluga-faza2-varijanta", async () => {
    const repeater = page.locator('[data-repeater="packages"]');
    await clickVisibly(repeater.locator("[data-repeater-add]"), { mobile });
    const row = repeater.locator("[data-repeater-row]").last();
    await typeSlowly(row.locator('[data-repeater-field="name"]'), "Jedna seansa");
    await row.locator('[data-repeater-field="sessions"]').fill("1");
    await row.locator('[data-repeater-field="duration"]').fill("60");
    await typeSlowly(row.locator('[data-repeater-field="totalPrice"]'), "4500");
  });
  await tut.step("usluga-faza2-nastavak", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expect(page.getByText("Faza 3 od 3")).toBeVisible();
  });

  await tut.step("usluga-faza3-objava", async () => {
    await scrollToSmoothly(page.locator("[data-submit-btn]"));
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const service = await Service.findOne({ name: serviceName });
  expect(service).toBeTruthy();
  expect(service.packages).toHaveLength(1);
  expect(service.packages[0].totalPrice).toBe(4500);
}
