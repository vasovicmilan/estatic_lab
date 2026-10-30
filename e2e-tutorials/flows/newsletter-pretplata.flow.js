import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";
import NewsLetter from "../../src/models/news-letter.model.js";

/**
 * Shared flow of "newsletter-pretplata" / "-mobilni" - a visitor subscribes through the footer
 * form (email, interest, explicit consent), an admin sees the subscriber in "Newsletter".
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const suffix = Date.now();
  const email = `tutorial-newsletter-${suffix}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  const footerForm = page.locator('footer form[action="/newsletter/prijava"]');
  await tut.step("newsletter-forma", async () => {
    await scrollToSmoothly(footerForm.locator('input[name="email"]'));
    await expect(footerForm.locator('input[name="email"]')).toBeVisible();
  });
  await tut.step("newsletter-email", async () => {
    await typeSlowly(footerForm.locator('input[name="email"]'), email);
  });
  await tut.step("newsletter-interesovanje", async () => {
    await clickVisibly(footerForm.locator("#newsletterInterestProducts"), { mobile });
  });
  await tut.step("newsletter-pristanak", async () => {
    await clickVisibly(footerForm.locator("#newsletterConsent"), { mobile });
  });
  await tut.step("newsletter-slanje", async () => {
    await clickVisibly(footerForm.getByRole("button", { name: "Prijavi se" }), { mobile });
    await expectFlashSuccess(page);
  });

  const subscriber = await NewsLetter.findOne({ email });
  expect(subscriber).toBeTruthy();
  expect(subscriber.consentedAt).toBeTruthy();

  // --- admin: sees the new subscriber ---
  const adminEmail = `tutorial-newsletter-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Sadržaj i marketing", itemLabel: "Newsletter", stepIdPrefix: "admin-newsletter", mobile });
  await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: email, stepIdPrefix: "admin-newsletter", mobile });

  await tut.step("admin-newsletter-pregled", async () => {
    await expect(adminPage.getByText(email).first()).toBeVisible();
  }, { page: adminPage, video: adminVideo });

  await finalizeAdminVideo();
}
