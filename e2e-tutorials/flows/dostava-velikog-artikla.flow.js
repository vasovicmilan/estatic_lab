import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, clickMainNavLink, openListedItem, clickVisibly, fillCheckoutContactAndAddressSlowly,
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, searchAndOpenAdminRecord,
} from "../scripts/slow-actions.js";
import { seedProduct, getOrderConfirmationUrl, findTemporaryOrderByEmail, expectFlashSuccess, confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "dostava-velikog-artikla" / "-mobilni". A large/heavy product (shippingClass
 * "freight") gets no automatic shipping price, so checkout does not finalize the order - it only
 * sends an informational "we'll calculate shipping" notice. The real, actionable confirm link is
 * emailed only once an admin sets the price (temporary-order.service.js's createTemporaryOrder /
 * updateTemporaryOrderShipping). Customer, then admin, then the customer again, all by clicks;
 * the confirmation link is the one place opened directly (it stands in for the email link).
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const product = await seedProduct({ shippingClass: "freight", price: 250000, stock: 3 });
  const customerEmail = `tutorial-freight-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Nikola", lastName: "Popović" });
  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${product.slug}`, id: "otvaranje-stranice-proizvoda" });
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();

  await tut.step("dodavanje-u-korpu", async () => {
    await clickVisibly(page.getByRole("button", { name: "Dodaj u korpu" }), { mobile });
    await page.waitForURL(/\/korpa/);
  });
  await tut.step("prelazak-na-naplatu", async () => {
    await clickVisibly(page.getByRole("link", { name: "Nastavi na naplatu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/naplata/);
  });
  await tut.step("unos-podataka-za-dostavu", async () => {
    await fillCheckoutContactAndAddressSlowly(page);
  });
  await tut.step("porudzbina-primljena", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi porudžbinu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    await expect(page.getByRole("heading", { name: "Porudžbina primljena" })).toBeVisible();
  });

  // --- admin: prices the shipping ---
  const adminEmail = `tutorial-freight-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Prodavnica", itemLabel: "Privremene porudžbine", stepIdPrefix: "admin-privremene", mobile });
  await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-privremene", mobile });
  await expect(adminPage.getByText("Čeka procenu (veliki/teški artikal)")).toBeVisible();

  await tut.step("admin-unosi-cenu-dostave", async () => {
    await typeSlowly(adminPage.locator('input[name="shippingAmount"]'), "8000");
    await clickVisibly(adminPage.getByRole("button", { name: "Sačuvaj cenu dostave" }), { mobile });
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);
  }, { page: adminPage, video: adminVideo });

  const updatedTempOrder = await findTemporaryOrderByEmail(customerEmail);
  expect(updatedTempOrder.requiresShippingQuote).toBe(false);
  expect(updatedTempOrder.shipping).toBe(8000);

  // --- customer: the new email arrives with the real confirm link ---
  await tut.step("email-potvrde-sa-cenom", async () => {
    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });

  await finalizeAdminVideo();
}
