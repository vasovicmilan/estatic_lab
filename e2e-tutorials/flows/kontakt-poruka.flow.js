import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { clickMainNavLink, fillLoginFormSlowly } from "../scripts/slow-actions.js";
import { confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";
import Contact from "../../src/models/contact.model.js";

/**
 * Shared flow of "kontakt-poruka" / "-mobilni" - a visitor writes through the contact form, an
 * admin finds the message in "Kontakt" and marks it answered. All by clicks.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const suffix = Date.now();
  const email = `tutorial-kontakt-${suffix}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await clickMainNavLink(page, tut, { mobile, href: "/kontakt", id: "nav-kontakt" });

  await tut.step("kontakt-ime", async () => {
    await typeSlowly(page.locator("#contact-firstName"), "Jovana");
    await typeSlowly(page.locator("#contact-lastName"), "Petrović");
  });
  await tut.step("kontakt-email", async () => {
    await typeSlowly(page.locator("#contact-email"), email);
  });
  await tut.step("kontakt-tema-poruka", async () => {
    await typeSlowly(page.locator("#contact-topic"), "Pitanje o tretmanu lica");
    await typeSlowly(page.locator("#contact-message"), "Zanima me koliko traje tretman i da li je potrebna prethodna konsultacija.");
  });
  await tut.step("kontakt-pristanak", async () => {
    const consent = page.locator("#consentCheck");
    await scrollToSmoothly(consent);
    await clickVisibly(consent, { mobile });
  });
  await tut.step("kontakt-slanje", async () => {
    await clickVisibly(page.getByRole("button", { name: "Pošalji poruku" }), { mobile });
    await expectFlashSuccess(page);
  });

  const contact = await Contact.findOne({ email });
  expect(contact).toBeTruthy();
  expect(contact.status).toBe("new");

  // --- admin: finds the message and marks it as answered ---
  const adminEmail = `tutorial-kontakt-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Sadržaj i marketing", itemLabel: "Kontakt", stepIdPrefix: "admin-kontakt", mobile });
  await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: email, stepIdPrefix: "admin-kontakt", mobile });

  await tut.step("admin-kontakt-status", async () => {
    await selectOptionVisibly(adminPage.locator('select[name="status"]'), "replied");
    await clickVisibly(adminPage.getByRole("button", { name: "Sačuvaj", exact: true }), { mobile });
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  const answered = await Contact.findOne({ email });
  expect(answered.status).toBe("replied");

  await finalizeAdminVideo();
}
