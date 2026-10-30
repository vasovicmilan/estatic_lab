import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { openMoreMenuLink, openListedItem } from "../scripts/slow-actions.js";
import BusinessPartner from "../../src/models/business-partner.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../fixtures/placeholder.jpg");

/**
 * Shared flow of "saradnici-dodavanje" / "-mobilni" - an admin adds a collaborator (a partner
 * company with its own showcase page and an outbound link carrying the salon's referral code),
 * then the public "Nasi saradnici" page shows it.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const name = `Kozmetička laboratorija ${suffix}`;
  const adminEmail = `tutorial-saradnik-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Saradnici", stepIdPrefix: "admin-saradnici", mobile });
  await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi saradnik", stepIdPrefix: "admin-saradnici" });

  await tut.step("saradnik-naziv", async () => {
    await typeSlowly(page.locator('input[name="name"]'), name);
  });
  await tut.step("saradnik-opis", async () => {
    await typeSlowly(page.locator('textarea[name="shortDescription"]'), "Naš provereni dobavljač profesionalne kozmetike.");
  });
  await tut.step("saradnik-slika", async () => {
    await uploadFileVisibly(page.locator('input[name="coverImage"]'), PLACEHOLDER_IMAGE);
    await typeSlowly(page.locator('input[name="coverImageDesc"]'), "Kozmetička laboratorija - naslovna slika");
  });
  await tut.step("saradnik-link", async () => {
    await typeSlowly(page.locator('input[name="outboundUrl"]'), "https://partner.example/?ref=estetiklab");
  });
  await tut.step("saradnik-cuvanje", async () => {
    await clickVisibly(page.locator("[data-submit-btn]"), { mobile });
    await expectFlashSuccess(page);
  });

  const partner = await BusinessPartner.findOne({ name });
  expect(partner).toBeTruthy();
  expect(partner.outboundUrl).toContain("ref=estetiklab");

  // --- the public page now lists it ---
  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await openMoreMenuLink(page, tut, { mobile, href: "/saradnici", id: "nav-saradnici" });
  await openListedItem(page, tut, { mobile, href: `/saradnici/${partner.slug}`, id: "otvaranje-saradnika" });
  await tut.step("stranica-saradnika", async () => {
    await expect(page.getByRole("heading", { name }).first()).toBeVisible();
    await expect(page.locator('a[rel~="sponsored"]').first()).toBeVisible();
  });
}
