import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  clickMainNavLink, openListedItem, clickVisibly, selectOptionVisibly, seedAdminUser, adminSignInViaNav,
  navigateAdminViaMenu, clickAdminCreateButton, scrollToSmoothly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import Product from "../../src/models/product.model.js";

/**
 * Shared flow of "cena-na-upit" / "cena-na-upit-mobilni". A product's real cost is sometimes too
 * volatile to quote (product.model.js's priceOnRequest): the public page shows "Cena na upit"
 * and a "contact us" link instead of "add to cart", and the sale happens OUTSIDE normal checkout -
 * a contact-form inquiry, then an admin manually creating the order with a hand-typed price
 * (order.controller.js's createManualOrder). Customer path, all clicks: menu -> "Prodavnica" ->
 * the product card -> "Kontaktirajte nas za cenu" -> form. Admin path: home -> "Prijava" -> form ->
 * account menu -> "Admin panel" -> "Prodavnica" > "Porudžbine" -> "Nova porudžbina (ručno)".
 */
export async function run({ page, browser, tut, mobile, scenarioId }) {
  const suffix = Date.now();
  const product = await Product.create({
    name: `Industrijska mašina za pranje ${suffix}`,
    slug: `industrijska-masina-za-pranje-${suffix}`,
    sku: `UPIT-${suffix}`,
    shortDescription: "Profesionalna oprema - cena zavisi od trenutnih uslova nabavke.",
    shippingClass: "freight",
    priceOnRequest: true,
    isActive: true,
    image: { img: "/images/site/default-og.webp", imgDesc: "E2E test placeholder slika" },
    variations: [{ label: "Standard", price: 0, stock: 1, isActive: true }],
  });
  const customerEmail = `tutorial-upit-${suffix}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${product.slug}`, id: "otvaranje-proizvoda-na-upit" });
  await expect(page.getByRole("heading", { name: "Cena na upit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dodaj u korpu" })).toHaveCount(0);

  await tut.step("prelazak-na-kontakt-formu", async () => {
    await clickVisibly(page.getByRole("link", { name: "Kontaktirajte nas za cenu" }), { mobile });
    await expect(page).toHaveURL(/\/kontakt/);
    // the topic field is pre-filled with the product name
    await expect(page.locator("#contact-topic")).toHaveValue(new RegExp(product.name));
  });

  await tut.step("popunjavanje-upita", async () => {
    await typeSlowly(page.locator("#contact-firstName"), "Vladimir");
    await typeSlowly(page.locator("#contact-lastName"), "Đorđević");
    await typeSlowly(page.locator("#contact-email"), customerEmail);
    await typeSlowly(page.locator("#contact-phone"), "0611234567");
    await typeSlowly(page.locator("#contact-message"), "Zanima me cena i rok isporuke za ovaj model.");
    if (mobile) await scrollToSmoothly(page.locator("#consentCheck"));
    await page.locator("#consentCheck").check();
  });

  await tut.step("slanje-upita", async () => {
    await clickVisibly(page.getByRole("button", { name: "Pošalji poruku" }), { mobile });
    await expectFlashSuccess(page);
  });

  // --- admin: sees the inquiry, creates the order by hand with a typed price ---
  const adminEmail = `tutorial-upit-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(
    browser, scenarioId, "admin-flow", "Administrator", { device: mobile ? "mobile" : "desktop" }
  );
  const adminPage = await adminContext.newPage();

  await adminSignInViaNav(adminPage, tut, adminVideo, { mobile, email: adminEmail });
  await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine", mobile });
  await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Nova porudžbina (ručno)", stepIdPrefix: "admin-porudzbine" });

  await tut.step("admin-bira-proizvod", async () => {
    // one "Proizvodi" row exists from the start (admin-manual-order.js); its variant list
    // fills in once a product is picked
    const row = adminPage.locator("[data-manual-row]").first();
    await selectOptionVisibly(row.locator('select[aria-label="Proizvod"]'), { value: product._id.toString() });
    await expect(row.locator('select[aria-label="Varijanta"]')).toBeEnabled();
    await selectOptionVisibly(row.locator('select[aria-label="Varijanta"]'), { index: 1 });
  }, { page: adminPage, video: adminVideo });

  await tut.step("admin-unosi-kontakt-i-cenu", async () => {
    await typeSlowly(adminPage.locator("#firstName"), "Vladimir");
    await typeSlowly(adminPage.locator("#lastName"), "Đorđević");
    await typeSlowly(adminPage.locator("#email"), customerEmail);
    await typeSlowly(adminPage.locator("#phone"), "0611234567");
    await typeSlowly(adminPage.locator("#addressCity"), "Novi Sad");
    await typeSlowly(adminPage.locator("#addressPostalCode"), "21000");
    await typeSlowly(adminPage.locator("#addressStreet"), "Industrijska zona");
    await typeSlowly(adminPage.locator("#addressNumber"), "5");
    // this product has no price until the admin types one - the whole reason this order exists
    // outside normal checkout (the row's own "Cena po komadu" field, "obavezno" here)
    await typeSlowly(adminPage.locator("[data-manual-row]").first().locator('input[aria-label="Cena po komadu"]'), "185000");
    await typeSlowly(adminPage.locator("#shipping"), "12000");
  }, { page: adminPage, video: adminVideo });

  await tut.step("admin-kreira-porudzbinu", async () => {
    await clickVisibly(adminPage.getByRole("button", { name: "Kreiraj porudžbinu" }), { mobile });
    await expectFlashSuccess(adminPage);
    await expect(adminPage).toHaveURL(/\/admin\/porudzbine\/detalji\//);
  }, { page: adminPage, video: adminVideo });

  const { default: Order } = await import("../../src/models/order.model.js");
  const order = await Order.findOne({ "contactSnapshot.email": customerEmail });
  expect(order).toBeTruthy();
  expect(order.items[0].price).toBe(185000);
  expect(order.totalPrice).toBe(197000); // 185000 (price) + 12000 (shipping)

  await finalizeAdminVideo();
}
