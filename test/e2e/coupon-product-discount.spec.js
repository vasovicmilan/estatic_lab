import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  seedProduct,
  seedPartner,
  seedCoupon,
  getOrderConfirmationUrl,
  findOrderByEmail,
  findCommissionEntriesForOrder,
  fillCheckoutContactAndAddress,
} from "./helpers/e2e-helpers.js";

/**
 * End-to-end coverage for the coupon.productDiscount split (see coupon.model.js /
 * coupon.service.js / commission.service.js) - the exact redesign discussed
 * earlier in this session: a coupon's discount for products is independent of its
 * discount for services/packages, capped separately, and a partner's commission on
 * a product sale uses commissionRateProducts, never commissionRateServices. Unit
 * tests already cover the calculation logic in isolation; this verifies the whole
 * chain a real customer and the real coupon-apply widget actually produce.
 */
test.describe("Checkout - coupon productDiscount block", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("applies the product-side discount (capped), and records the partner's commission at the products rate, not the services rate", async ({ page }) => {
    // deliberately different rates so a bug that swapped them would be caught
    const { partner } = await seedPartner({ commissionRateServices: 15, commissionRateProducts: 3, maxCommissionAmountProducts: null });
    const product = await seedProduct({ shippingClass: "standard", price: 100000, stock: 5 });
    const coupon = await seedCoupon({
      partner,
      // main block deliberately left at very different numbers than productDiscount
      // below - if the order flow ever fell back to the main block by mistake, this
      // test's discount-amount assertion would catch it
      discountType: "fixed",
      discountValue: 1,
      productDiscount: {
        discountType: "percentage",
        discountValue: 15,
        maxDiscountAmount: 2000, // 15% of 100000 would be 15000 - the cap is what actually applies
        minOrderValue: 0,
        applicableProducts: [],
      },
    });

    const customerEmail = `e2e-coupon-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    await page.goto(`/prodavnica/${product.slug}`);
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();

    await page.goto("/korpa");
    await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
    await fillCheckoutContactAndAddress(page);

    await page.fill("[data-coupon-input]", coupon.code);
    await page.click("[data-coupon-apply-btn]");
    await expect(page.locator("[data-coupon-applied-badge]")).toBeVisible();
    // capped at 2000, not the uncapped 15000 a naive 15%-of-100000 calculation
    // would give - this is the specific guardrail today's redesign was built for
    await expect(page.locator("[data-coupon-applied-discount]")).toHaveText("2000");

    await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);

    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();

    const order = await findOrderByEmail(customerEmail);
    expect(order.discountApplied).toBe(2000);
    expect(order.coupon.toString()).toBe(coupon._id.toString());

    // order:confirmed's commission-recording listener runs asynchronously after the
    // HTTP response is already sent (see commission.listener.js) - poll rather than
    // assert immediately to avoid a race against that
    await expect
      .poll(async () => {
        const entries = await findCommissionEntriesForOrder(order._id);
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [entry] = await findCommissionEntriesForOrder(order._id);
    expect(entry.earnerType).toBe("partner");
    expect(entry.rate).toBe(3); // commissionRateProducts, never the 15 from commissionRateServices
    expect(entry.amount).toBe(Math.round(order.totalPrice * 0.03 * 100) / 100);
    expect(entry.status).toBe("pending"); // order commissions start pending - see commission.service.js
  });

  test("a coupon with no productDiscount block is rejected for a product order", async ({ page }) => {
    const product = await seedProduct({ shippingClass: "standard", price: 5000, stock: 5 });
    // main block only - productDiscount left null (the default, restrictive-by-design
    // state - see coupon.model.js)
    const coupon = await seedCoupon({ discountType: "percentage", discountValue: 50 });

    const customerEmail = `e2e-coupon-reject-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: customerEmail });

    await page.goto(`/prodavnica/${product.slug}`);
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();

    await page.goto("/korpa");
    await page.getByRole("link", { name: "Nastavi na naplatu" }).click();

    await page.fill("[data-coupon-input]", coupon.code);
    await page.click("[data-coupon-apply-btn]");

    await expect(page.locator("[data-coupon-error]")).toBeVisible();
    await expect(page.locator("[data-coupon-applied-badge]")).toBeHidden();
  });
});