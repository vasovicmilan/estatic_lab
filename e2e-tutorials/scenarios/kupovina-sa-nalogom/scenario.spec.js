import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly } from "../../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - the counterpart to
 * kupovina-bez-naloga (guest). Two things worth showing that other scenarios
 * skip: (1) registration actually collects a phone number too (auth/_auth-form.ejs
 * has the field, optional, but every other tutorial's registerViaUISlowly call
 * leaves it blank since it's not their focus), and (2) a logged-in customer can
 * save an address once (user.controller.js's addAddress - a dedicated account
 * page, NOT something checkout itself ever writes to automatically) and then
 * either reuse it or enter a different one at checkout (shop/checkout.ejs's
 * "Sačuvana adresa" dropdown, defaulting to "Unesite novu adresu"). Two
 * purchases shown specifically to demonstrate BOTH paths through that dropdown,
 * not just the existence of the feature.
 */
test.describe("Tutorial: kupovina sa nalogom", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("registrovan klijent čuva adresu, pa je ponovo koristi ili unosi novu", async ({ page, tut }) => {
    test.slow();

    const productA = await seedProduct({ price: 2800, stock: 10 });
    const productB = await seedProduct({ price: 3900, stock: 10 });
    const coupon = await seedCoupon({
      discountType: "percentage",
      discountValue: 15,
      productDiscount: { discountType: "percentage", discountValue: 15, maxDiscountAmount: 5000, minOrderValue: 0, applicableProducts: [] },
    });

    const customerEmail = `tutorial-account-${Date.now()}@example.com`;

    await tut.step("registracija-sa-telefonom", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Katarina", lastName: "Radović", phone: "0631234567" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    await tut.step("otvaranje-adresa", async () => {
      await page.goto("/nalog/adrese");
      await expect(page.locator('input[name="street"]')).toBeVisible();
    });

    await tut.step("cuvanje-adrese", async () => {
      await typeSlowly(page.locator('input[name="street"]'), "Fruškogorska");
      await typeSlowly(page.locator('input[name="number"]'), "8");
      await typeSlowly(page.locator('input[name="city"]'), "Novi Sad");
      await typeSlowly(page.locator('input[name="postalCode"]'), "21000");
      await page.getByRole("button", { name: /Sačuvaj/i }).click();
      await expect(page).toHaveURL(/\/nalog\/adrese/);
    });

    // --- prva kupovina: koristi već sačuvanu adresu, bez kupona ---
    await tut.step("otvaranje-prvog-proizvoda", async () => {
      await page.goto(`/prodavnica/${productA.slug}`);
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    });

    await tut.step("prelazak-na-naplatu-1", async () => {
      await page.goto("/korpa");
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
      // email i telefon su već popunjeni jer je klijent prijavljen
      await expect(page.locator("#checkout-email")).toHaveValue(customerEmail);
    });

    await tut.step("izbor-sacuvane-adrese", async () => {
      // tačan format opcije iz shop/checkout.ejs kad nema unetog naziva adrese:
      // "{ulica} {broj}, {grad}" - bez naziva i bez crtice ispred
      await page.locator("#checkout-saved-address").selectOption({ label: "Fruškogorska 8, Novi Sad" });
      await expect(page.locator("#addr-street")).toHaveValue("Fruškogorska");
    });

    await tut.step("potvrda-porudzbine-1", async () => {
      await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
      await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    });

    await tut.step("email-potvrde-1", async () => {
      const confirmUrl = await getOrderConfirmationUrl(customerEmail);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });

    // --- druga kupovina: unosi NOVU adresu, sa kuponom ---
    await tut.step("otvaranje-drugog-proizvoda", async () => {
      await page.goto(`/prodavnica/${productB.slug}`);
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    });

    await tut.step("prelazak-na-naplatu-2", async () => {
      await page.goto("/korpa");
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
    });

    await tut.step("unos-nove-adrese", async () => {
      // padajuća lista i dalje ima sačuvanu adresu kao opciju, ali klijent ovog
      // puta bira "Unesite novu adresu" (podrazumevana opcija) i ukuca drugu
      await page.locator("#checkout-saved-address").selectOption({ label: "Unesite novu adresu" });
      await typeSlowly(page.locator("#addr-street"), "Temerinska");
      await typeSlowly(page.locator("#addr-number"), "101");
      await typeSlowly(page.locator("#addr-city"), "Novi Sad");
      await typeSlowly(page.locator("#addr-postalCode"), "21000");
    });

    await tut.step("primena-kupona-2", async () => {
      await typeSlowly(page.locator("[data-coupon-input]"), coupon.code);
      await page.click("[data-coupon-apply-btn]");
      await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
    });

    await tut.step("potvrda-porudzbine-2", async () => {
      await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
      await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    });

    await tut.step("email-potvrde-2", async () => {
      const confirmUrl = await getOrderConfirmationUrl(customerEmail);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });
  });
});
