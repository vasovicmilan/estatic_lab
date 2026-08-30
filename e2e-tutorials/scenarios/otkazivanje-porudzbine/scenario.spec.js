import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedCustomer, seedProduct, seedOrder, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Product from "../../../src/models/product.model.js";
import Order from "../../../src/models/order.model.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * order-cancellation.spec.js's first case. Worth its own tutorial for the
 * cancellation MODAL alone: unlike every other admin status-change action shown
 * elsewhere (a plain "are you sure?" confirm), cancelling/returning an order asks
 * for a written reason first (order-status-actions.ejs's needsReason branch - a
 * real form with a textarea, not confirmActionModal's generic yes/no) - and,
 * invisibly to the admin clicking the button, restores the product's stock
 * (order.service.js's transitionStatus -> restoreVariationStock).
 */
test.describe("Tutorial: otkazivanje porudžbine", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin otkazuje porudžbinu uz razlog, zaliha proizvoda se vraća na stanje", async ({ page, tut }) => {
    const product = await seedProduct({ price: 2000, stock: 5 });
    const customer = await seedCustomer();
    // 2 komada je već skinuto sa stanja pri checkout-u (videti
    // temporary-order.service.js's decreaseVariationStock) - ova porudžbina
    // predstavlja to već umanjeno stanje, trenutno na 3
    await Product.updateOne({ _id: product._id }, { $set: { "variations.0.stock": 3 } });
    const order = await seedOrder({ customer, status: "pending", subtotal: 4000, product, quantity: 2 });

    const adminEmail = `tutorial-order-cancel-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine" });
    await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: customer.email, stepIdPrefix: "admin-porudzbine" });

    await tut.step("otvaranje-modala-za-otkazivanje", async () => {
      await page.getByRole("button", { name: "Otkaži porudžbinu" }).click();
      await expect(page.locator(".modal.show")).toBeVisible();
    });

    await tut.step("unos-razloga", async () => {
      const modal = page.locator(".modal.show");
      await typeSlowly(modal.locator('textarea[name="reason"]'), "Kupac je odustao od porudžbine");
    });

    await tut.step("potvrda-otkazivanja", async () => {
      const modal = page.locator(".modal.show");
      await modal.getByRole("button", { name: "Potvrdi" }).click();
      await expectFlashSuccess(page);
    });

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe("cancelled");

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variations[0].stock).toBe(5); // 3 + 2 vraćena iz otkazane porudžbine
  });
});
