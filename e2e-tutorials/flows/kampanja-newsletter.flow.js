import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import Campaign from "../../src/models/campaign.model.js";

/**
 * Shared flow of "kampanja-newsletter" / "-mobilni" - the admin prepares a newsletter campaign:
 * internal name, subject, segment, content blocks, saved as a draft (nothing is sent).
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const title = `Jesenja ponuda ${suffix}`;
  const adminEmail = `tutorial-kampanja-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Kampanje", stepIdPrefix: "admin-kampanje", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Nova kampanja", stepIdPrefix: "admin-kampanje" });

  await tut.step("kampanja-naziv", async () => {
    await typeSlowly(page.locator('input[name="title"]'), title);
  });
  await tut.step("kampanja-predmet", async () => {
    await typeSlowly(page.locator('input[name="subject"]'), "Jesenja ponuda: tretmani lica uz popust");
  });
  await tut.step("kampanja-segment", async () => {
    const box = page.locator('input[name="targetInterests"][value="products"]');
    await scrollToSmoothly(box);
    await clickVisibly(box, { mobile });
  });
  await tut.step("kampanja-sadrzaj", async () => {
    const widget = page.locator('[data-content-blocks="content"]');
    await scrollToSmoothly(widget);
    await widget.locator("[data-block-type-select]").selectOption("paragraph");
    await clickVisibly(widget.locator("[data-block-add]"), { mobile });
    const block = widget.locator("[data-content-block]").last();
    await typeSlowly(block.locator('[data-block-field="text"]'), "Ove jeseni pripremili smo posebne cene za tretmane lica. Termine možete zakazati online.");
  });
  await tut.step("kampanja-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const campaign = await Campaign.findOne({ title });
  expect(campaign).toBeTruthy();
  expect(campaign.status).toBe("draft");
  expect(campaign.content.length).toBeGreaterThan(0);
}
