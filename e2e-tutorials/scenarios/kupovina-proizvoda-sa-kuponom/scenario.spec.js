import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, fillCheckoutContactAndAddressSlowly } from "../../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - the everyday customer purchase flow:
 * browse a product, add to cart, apply a coupon at checkout, confirm the order.
 * Adapted from checkout-freight-shipping.spec.js's "standard shipping" path
 * (immediate confirmation, no admin quote step) combined with
 * coupon-product-discount.spec.js's coupon-apply step - the two most common
 * pieces of a real purchase told as one narrative, rather than two separate specs'
 * separate concerns (freight quoting, productDiscount-vs-serviceDiscount edge
 * cases) which aren't worth narrating to a client audience.
 */
test.describe("Tutorial: kupovina proizvoda sa kuponom", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("klijent kupuje proizvod i primenjuje kupon na naplati", async ({ page, tut }) => {
    const product = await seedProduct({ shippingClass: "standard", price: 4500, stock: 10 });
    const coupon = await seedCoupon({
      discountType: "percentage",
      discountValue: 10,
      productDiscount: {
        discountType: "percentage",
        discountValue: 10,
        maxDiscountAmount: 5000,
        minOrderValue: 0,
        applicableProducts: [],
      },
    });

    const customerEmail = `tutorial-checkout-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Jovana", lastName: "Ilić" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    await tut.step("otvaranje-stranice-proizvoda", async () => {
      await page.goto(`/prodavnica/${product.slug}`);
      await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    });

    await tut.step("dodavanje-u-korpu", async () => {
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    });

    await tut.step("otvaranje-korpe", async () => {
      await page.goto("/korpa");
      await expect(page.getByRole("link", { name: "Nastavi na naplatu" })).toBeVisible();
    });

    await tut.step("prelazak-na-naplatu", async () => {
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
      await expect(page).toHaveURL(/\/korpa\/naplata/);
    });

    await tut.step("unos-podataka-za-dostavu", async () => {
      await fillCheckoutContactAndAddressSlowly(page);
    });

    await tut.step("primena-kupona", async () => {
      await typeSlowly(page.locator("[data-coupon-input]"), coupon.code);
      await page.click("[data-coupon-apply-btn]");
      await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
    });

    await tut.step("potvrda-porudzbine", async () => {
      await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
      await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    });

    await tut.step("potvrda-preko-linka", async () => {
      // stands in for the confirmation email link a real customer would click -
      // E2E has no mailbox to read it from (see e2e-helpers.js's
      // getOrderConfirmationUrl), so this reads it directly out of the database;
      // the actual page navigation still goes through the real route.
      const confirmUrl = await getOrderConfirmationUrl(customerEmail);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });
  });
});
