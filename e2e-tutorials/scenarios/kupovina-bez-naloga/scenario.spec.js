import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { fillGuestCheckoutSlowly } from "../../scripts/slow-actions.js";
import { seedProduct, seedCoupon, getOrderConfirmationUrl } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - the point being demonstrated is
 * specifically that NO account is ever explicitly created: the customer never
 * visits /registracija at all. temporary-order.service.js's createTemporaryOrder
 * looks up `needsGuestUser` by email - if no User exists for that email yet, one
 * is created automatically inside the same transaction as the order itself (see
 * that function's own comment). Two full guest purchases are shown, each with a
 * DIFFERENT email, specifically so each one independently exercises that
 * auto-create moment (checkout.ejs's own "Ako nemate nalog..." note) rather than
 * the second purchase silently reusing the first's now-existing account.
 */
test.describe("Tutorial: kupovina bez naloga (gost)", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("gost kupuje bez i sa kuponom, nalog se automatski pravi oba puta", async ({ page, tut }) => {
    test.slow();

    const productA = await seedProduct({ price: 3200, stock: 10 });
    const productB = await seedProduct({ price: 4500, stock: 10 });
    const coupon = await seedCoupon({
      discountType: "percentage",
      discountValue: 10,
      productDiscount: { discountType: "percentage", discountValue: 10, maxDiscountAmount: 5000, minOrderValue: 0, applicableProducts: [] },
    });

    const guestEmailA = `tutorial-guest-a-${Date.now()}@example.com`;
    const guestEmailB = `tutorial-guest-b-${Date.now()}@example.com`;

    // --- prva kupovina: bez kupona ---
    await tut.step("otvaranje-prvog-proizvoda", async () => {
      await page.goto(`/prodavnica/${productA.slug}`);
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    });

    await tut.step("prelazak-na-naplatu-1", async () => {
      await page.goto("/korpa");
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
      await expect(page).toHaveURL(/\/korpa\/naplata/);
      // ovo je poenta scenarija - klijent NIJE prijavljen, a sistem ga na to
      // upozorava i objašnjava šta se dešava
      await expect(page.getByText(/automatski ćemo vam kreirati/i)).toBeVisible();
    });

    await tut.step("unos-podataka-kao-gost-1", async () => {
      await fillGuestCheckoutSlowly(page, {
        firstName: "Jelena",
        lastName: "Marković",
        email: guestEmailA,
        phone: "0641112233",
        street: "Bulevar Cara Lazara",
        number: "15",
        city: "Novi Sad",
        postalCode: "21000",
      });
    });

    await tut.step("potvrda-porudzbine-1", async () => {
      await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
      await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    });

    const { default: User } = await import("../../../src/models/user.model.js");

    await tut.step("nalog-automatski-kreiran-1", async () => {
      // sistem je upravo, u pozadini, napravio pravi User nalog za ovaj email -
      // klijent to nije morao ni video da traži
      await expect
        .poll(async () => Boolean(await User.findOne({ email: guestEmailA })), { timeout: 10_000 })
        .toBe(true);
    });

    await tut.step("email-potvrde-1", async () => {
      const confirmUrl = await getOrderConfirmationUrl(guestEmailA);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });

    // --- druga kupovina: sa kuponom, potpuno nov gost ---
    await tut.step("otvaranje-drugog-proizvoda", async () => {
      await page.goto(`/prodavnica/${productB.slug}`);
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    });

    await tut.step("prelazak-na-naplatu-2", async () => {
      await page.goto("/korpa");
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
    });

    await tut.step("unos-podataka-kao-gost-2", async () => {
      await fillGuestCheckoutSlowly(page, {
        firstName: "Uroš",
        lastName: "Ilić",
        email: guestEmailB,
        phone: "0651234567",
        street: "Narodnog fronta",
        number: "42",
        city: "Novi Sad",
        postalCode: "21000",
      });
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

    await tut.step("nalog-automatski-kreiran-2", async () => {
      await expect
        .poll(async () => Boolean(await User.findOne({ email: guestEmailB })), { timeout: 10_000 })
        .toBe(true);
    });

    await tut.step("email-potvrde-2", async () => {
      const confirmUrl = await getOrderConfirmationUrl(guestEmailB);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });
  });
});
