import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, openAccountMenuItem, backToSiteFromPortal, clickMainNavLink,
  openListedItem, clickVisibly, selectOptionVisibly, scrollToSmoothly,
} from "../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "kupovina-sa-nalogom" / "kupovina-sa-nalogom-mobilni" - the counterpart of
 * kupovina-bez-naloga. Two things other tutorials skip: (1) registration also collects a
 * phone number, and (2) a logged-in customer saves an address once (/nalog/adrese - a
 * dedicated account page, never written by checkout itself) and then either reuses it or
 * types a different one at checkout (shop/checkout.ejs's "Sačuvana adresa" dropdown).
 * Reached by clicking: account menu -> "Moje adrese"; the account pages have their own slim
 * header, so the way back to the shop is its "Nazad na sajt" entry.
 */
export async function run({ page, tut, mobile }) {
  const productA = await seedProduct({ price: 2800, stock: 10 });
  const productB = await seedProduct({ price: 3900, stock: 10 });
  const coupon = await seedCoupon({
    discountType: "percentage",
    discountValue: 15,
    productDiscount: { discountType: "percentage", discountValue: 15, maxDiscountAmount: 5000, minOrderValue: 0, applicableProducts: [] },
  });
  const customerEmail = `tutorial-account-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, {
    mobile, email: customerEmail, firstName: "Katarina", lastName: "Radović", phone: "0631234567", stepId: "registracija-sa-telefonom",
  });

  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await openAccountMenuItem(page, tut, { mobile, href: "/nalog/adrese", stepIdPrefix: "nalog-adrese" });
  await expect(page.locator('input[name="street"]')).toBeVisible();

  await tut.step("cuvanje-adrese", async () => {
    await scrollToSmoothly(page.locator('input[name="street"]'));
    await typeSlowly(page.locator('input[name="street"]'), "Fruškogorska");
    await typeSlowly(page.locator('input[name="number"]'), "8");
    await typeSlowly(page.locator('input[name="city"]'), "Novi Sad");
    await typeSlowly(page.locator('input[name="postalCode"]'), "21000");
    await clickVisibly(page.getByRole("button", { name: /Sačuvaj/i }), { mobile });
    await expect(page).toHaveURL(/\/nalog\/adrese/);
  });

  await backToSiteFromPortal(page, tut);

  // --- prva kupovina: koristi već sačuvanu adresu, bez kupona ---
  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${productA.slug}`, id: "otvaranje-prvog-proizvoda" });

  await tut.step("dodavanje-u-korpu-1", async () => {
    await clickVisibly(page.getByRole("button", { name: "Dodaj u korpu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa/);
  });

  await tut.step("prelazak-na-naplatu-1", async () => {
    await clickVisibly(page.getByRole("link", { name: "Nastavi na naplatu" }), { mobile });
    // email i telefon su već popunjeni jer je klijent prijavljen
    await expect(page.locator("#checkout-email")).toHaveValue(customerEmail);
  });

  await tut.step("izbor-sacuvane-adrese", async () => {
    // exact option format from shop/checkout.ejs when the address has no name: "{ulica} {broj}, {grad}"
    await selectOptionVisibly(page.locator("#checkout-saved-address"), { label: "Fruškogorska 8, Novi Sad" });
    await expect(page.locator("#addr-street")).toHaveValue("Fruškogorska");
  });

  await tut.step("potvrda-porudzbine-1", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi porudžbinu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
  });

  await tut.step("email-potvrde-1", async () => {
    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });

  // --- druga kupovina: unosi NOVU adresu, sa kuponom ---
  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${productB.slug}`, id: "otvaranje-drugog-proizvoda" });

  await tut.step("dodavanje-u-korpu-2", async () => {
    await clickVisibly(page.getByRole("button", { name: "Dodaj u korpu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa/);
  });

  await tut.step("prelazak-na-naplatu-2", async () => {
    await clickVisibly(page.getByRole("link", { name: "Nastavi na naplatu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/naplata/);
  });

  await tut.step("unos-nove-adrese", async () => {
    // the dropdown still offers the saved address, but this time the customer keeps
    // "Unesite novu adresu" (the default option) and types a different one
    await selectOptionVisibly(page.locator("#checkout-saved-address"), { label: "Unesite novu adresu" });
    await typeSlowly(page.locator("#addr-street"), "Temerinska");
    await typeSlowly(page.locator("#addr-number"), "101");
    await typeSlowly(page.locator("#addr-city"), "Novi Sad");
    await typeSlowly(page.locator("#addr-postalCode"), "21000");
  });

  await tut.step("primena-kupona-2", async () => {
    const input = page.locator("[data-coupon-input]");
    if (mobile) await scrollToSmoothly(input);
    await typeSlowly(input, coupon.code);
    await clickVisibly(page.locator("[data-coupon-apply-btn]"), { mobile });
    await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
  });

  await tut.step("potvrda-porudzbine-2", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi porudžbinu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
  });

  await tut.step("email-potvrde-2", async () => {
    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });
}
