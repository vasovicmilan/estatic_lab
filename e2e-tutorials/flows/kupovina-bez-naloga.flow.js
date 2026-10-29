import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import { clickMainNavLink, openListedItem, clickVisibly, fillGuestCheckoutSlowly, scrollToSmoothly } from "../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "kupovina-bez-naloga" / "kupovina-bez-naloga-mobilni". The point being
 * demonstrated is that NO account is ever explicitly created - the customer never opens
 * the registration page; temporary-order.service.js's createTemporaryOrder creates the
 * account inside the same transaction as the order. Two guest purchases, each with a
 * DIFFERENT email, so each one independently exercises that auto-create moment.
 * Every page is reached by clicking: menu -> Prodavnica -> product card -> "Dodaj u korpu"
 * (the app redirects to the cart) -> "Nastavi na naplatu". The confirmation page is the one
 * place a link is opened directly - it stands in for the link in the confirmation email.
 */
export async function run({ page, tut, mobile }) {
  const productA = await seedProduct({ price: 3200, stock: 10 });
  const productB = await seedProduct({ price: 4500, stock: 10 });
  const coupon = await seedCoupon({
    discountType: "percentage",
    discountValue: 10,
    productDiscount: { discountType: "percentage", discountValue: 10, maxDiscountAmount: 5000, minOrderValue: 0, applicableProducts: [] },
  });
  const guestEmailA = `tutorial-guest-a-${Date.now()}@example.com`;
  const guestEmailB = `tutorial-guest-b-${Date.now()}@example.com`;
  const { default: User } = await import("../../src/models/user.model.js");

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  // --- prva kupovina: bez kupona ---
  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${productA.slug}`, id: "otvaranje-prvog-proizvoda" });

  await tut.step("dodavanje-u-korpu-1", async () => {
    await clickVisibly(page.getByRole("button", { name: "Dodaj u korpu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa/);
  });

  await tut.step("prelazak-na-naplatu-1", async () => {
    await clickVisibly(page.getByRole("link", { name: "Nastavi na naplatu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/naplata/);
    // the point of the scenario - the customer is NOT logged in, and the system says so
    // and explains what happens
    await expect(page.getByText(/automatski ćemo vam kreirati/i)).toBeVisible();
  });

  await tut.step("unos-podataka-kao-gost-1", async () => {
    await fillGuestCheckoutSlowly(page, {
      firstName: "Jelena", lastName: "Marković", email: guestEmailA, phone: "0641112233",
      street: "Bulevar Cara Lazara", number: "15", city: "Novi Sad", postalCode: "21000",
    });
  });

  await tut.step("potvrda-porudzbine-1", async () => {
    await clickVisibly(page.getByRole("button", { name: "Potvrdi porudžbinu" }), { mobile });
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
  });

  await tut.step("nalog-automatski-kreiran-1", async () => {
    // the system has just created a real User account for this email in the background
    await expect.poll(async () => Boolean(await User.findOne({ email: guestEmailA })), { timeout: 10_000 }).toBe(true);
  });

  await tut.step("email-potvrde-1", async () => {
    const confirmUrl = await getOrderConfirmationUrl(guestEmailA);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });

  // --- druga kupovina: sa kuponom, potpuno nov gost ---
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

  await tut.step("unos-podataka-kao-gost-2", async () => {
    await fillGuestCheckoutSlowly(page, {
      firstName: "Uroš", lastName: "Ilić", email: guestEmailB, phone: "0651234567",
      street: "Narodnog fronta", number: "42", city: "Novi Sad", postalCode: "21000",
    });
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

  await tut.step("nalog-automatski-kreiran-2", async () => {
    await expect.poll(async () => Boolean(await User.findOne({ email: guestEmailB })), { timeout: 10_000 }).toBe(true);
  });

  await tut.step("email-potvrde-2", async () => {
    const confirmUrl = await getOrderConfirmationUrl(guestEmailB);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });
}
