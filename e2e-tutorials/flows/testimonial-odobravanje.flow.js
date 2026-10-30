import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import Testimonial from "../../src/models/testimonial.model.js";

/**
 * Shared flow of "testimonial-odobravanje" / "-mobilni" - a visitor leaves a review on the home
 * page (rating, text, explicit consent); it stays hidden until an admin approves it in
 * "Testimoniali". Reviews are shown (and counted in the structured data) only after approval.
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const suffix = Date.now();
  const guestName = `Jelena Marković ${suffix}`;
  const message = `Odlično iskustvo, tretman je bio profesionalan i prijatan. ${suffix}`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  const form = page.locator('form[action="/testimonials/posalji"]');
  await tut.step("utisak-forma", async () => {
    await scrollToSmoothly(form.locator("#testimonial-name"));
    await expect(form.locator("#testimonial-name")).toBeVisible();
  });
  await tut.step("utisak-ime", async () => {
    await typeSlowly(form.locator("#testimonial-name"), guestName);
  });
  await tut.step("utisak-ocena", async () => {
    await clickVisibly(form.locator('label[for="testimonial-rating-5"]'), { mobile });
  });
  await tut.step("utisak-poruka", async () => {
    await typeSlowly(form.locator("#testimonial-message"), message);
  });
  await tut.step("utisak-pristanak", async () => {
    await clickVisibly(form.locator("#testimonial-consent"), { mobile });
  });
  await tut.step("utisak-slanje", async () => {
    await clickVisibly(form.getByRole("button", { name: "Pošalji utisak" }), { mobile });
    await expectFlashSuccess(page);
  });

  const created = await Testimonial.findOne({ message });
  expect(created).toBeTruthy();
  expect(created.status).toBe("pending");

  // --- admin: reviews it and approves ---
  const adminEmail = `tutorial-utisak-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Sadržaj i marketing", itemLabel: "Testimoniali", stepIdPrefix: "admin-testimoniali", mobile });

  await tut.step("admin-testimoniali-otvaranje", async () => {
    const row = adminPage.locator("tr", { hasText: guestName });
    const link = (await row.count()) > 0 ? row.locator('a[title="Detalji"]').first() : adminPage.locator('a[title="Detalji"]').first();
    if (mobile) {
      await link.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }));
      await adminPage.waitForTimeout(900);
    }
    await link.click();
    await expect(adminPage.getByRole("button", { name: "Odobri" })).toBeVisible();
  }, { page: adminPage, video: adminVideo });

  await tut.step("admin-testimoniali-odobrava", async () => {
    await clickVisibly(adminPage.getByRole("button", { name: "Odobri" }), { mobile });
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  const approved = await Testimonial.findOne({ message });
  expect(approved.status).toBe("approved");

  await finalizeAdminVideo();
}
