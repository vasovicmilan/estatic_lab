import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import SiteSettings from "../../src/models/site-settings.model.js";

/**
 * Shared flow of "podesavanja-sajta" / "-mobilni" - the admin changes the booking policy and the
 * price display in "Podesavanja sajta"; no code change, no restart, effective immediately.
 */
export async function run({ page, tut, mobile }) {
  const adminEmail = `tutorial-sajt-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Podešavanja sajta", stepIdPrefix: "admin-sajt", mobile });

  await tut.step("sajt-politika-zakazivanja", async () => {
    const buffer = page.locator('input[name="bufferMinutes"]');
    await highlight(buffer);
    await buffer.fill("45");
  });

  await tut.step("sajt-otkazivanje", async () => {
    const cutoff = page.locator('input[name="userCancellationCutoffHours"]');
    await highlight(cutoff);
    await cutoff.fill("12");
  });

  await tut.step("sajt-valuta", async () => {
    const symbol = page.locator('input[name="currencySymbol"]');
    await highlight(symbol);
    await symbol.fill("din");
  });

  await tut.step("sajt-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]").first(), { mobile });
    await expectFlashSuccess(page);
  });

  const settings = await SiteSettings.findOne();
  expect(settings.bookingPolicy.bufferMinutes).toBe(45);
  expect(settings.bookingPolicy.userCancellationCutoffHours).toBe(12);
  expect(settings.currency.symbol).toBe("din");
}
