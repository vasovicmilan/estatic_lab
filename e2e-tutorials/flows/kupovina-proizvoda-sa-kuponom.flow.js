import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, clickMainNavLink, openListedItem, clickVisibly,
  fillCheckoutContactAndAddressSlowly, scrollToSmoothly,
} from "../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "kupovina-proizvoda-sa-kuponom" (computer) and
 * "kupovina-proizvoda-sa-kuponom-mobilni" (phone) - the two spec files only choose
 * the device. Everything is reached by clicking: home page -> (burger) -> Registracija ->
 * form -> login form -> Prodavnica -> the product's card -> "Dodaj u korpu" (the app
 * itself redirects to the cart) -> "Nastavi na naplatu" -> checkout.
 * The one remaining URL jump is the email confirmation link (no mailbox in E2E) - narrated
 * as exactly that.
 */
export async function run({ page, tut, mobile }) {
  const product = await seedProduct({ shippingClass: "standard", price: 4500, stock: 10 });
  const coupon = await seedCoupon({
    discountType: "percentage",
    discountValue: 10,
    productDiscount: { discountType: "percentage", discountValue: 10, maxDiscountAmount: 5000, minOrderValue: 0, applicableProducts: [] },
  });
  const customerEmail = `tutorial-checkout-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Jovana", lastName: "Ilić" });

  await tut.step("prijava", async () => {
    // registration redirects to /prijava - the login form is already in front of us
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${product.slug}`, id: "otvaranje-stranice-proizvoda" });
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();

  await tut.step("dodavanje-u-korpu", async () => {
    // "Dodaj u korpu" posts the form and the app redirects straight to the cart
    await clickVisibly(page.getByRole("button", { name: "Dodaj u korpu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa/);
    await expect(page.getByRole("link", { name: "Nastavi na naplatu" })).toBeVisible();
  });

  await tut.step("prelazak-na-naplatu", async () => {
    await clickVisibly(page.getByRole("link", { name: "Nastavi na naplatu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/naplata/);
  });

  await tut.step("unos-podataka-za-dostavu", async () => {
    await fillCheckoutContactAndAddressSlowly(page);
  });

  await tut.step("primena-kupona", async () => {
    const input = page.locator("[data-coupon-input]");
    if (mobile) await scrollToSmoothly(input);
    await typeSlowly(input, coupon.code);
    await clickVisibly(page.locator("[data-coupon-apply-btn]"), { mobile });
    await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
  });

  await tut.step("potvrda-porudzbine", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi porudžbinu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
  });

  await tut.step("potvrda-preko-linka", async () => {
    // stands in for the confirmation email link a real customer would click - E2E has no
    // mailbox to read it from (see e2e-helpers.js's getOrderConfirmationUrl), so the link
    // is read out of the database; the page itself is still the real route.
    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });
}
