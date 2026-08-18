import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedCustomer,
  seedProduct,
  seedOrder,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import Product from "../../src/models/product.model.js";
import Order from "../../src/models/order.model.js";

/**
 * End-to-end coverage for stock restoration when an admin cancels or returns an
 * order - order.service.js's transitionStatus calls restoreVariationStock for
 * exactly those two statuses (see its comment), never exercised through a real
 * browser before this suite existed. Order commission REVERSAL on cancellation is
 * a separate, already-thoroughly-unit-tested mechanism (commission.service.js's
 * processGracePeriodCommissions, a scheduled job - not something a UI action
 * triggers synchronously), so this spec is scoped to what an admin's click
 * actually, observably does: the stock count.
 */
test.describe("Order cancellation/return restores product stock", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("cancelling a pending order gives its reserved stock back", async ({ page }) => {
    const product = await seedProduct({ price: 2000, stock: 5 });
    const customer = await seedCustomer();
    // 2 units were taken off the shelf at checkout time (see
    // temporary-order.service.js's decreaseVariationStock) - this order
    // represents that already-decremented state, stock currently sitting at 3
    await Product.updateOne({ _id: product._id }, { $set: { "variations.0.stock": 3 } });
    const order = await seedOrder({ customer, status: "pending", subtotal: 4000, product, quantity: 2 });

    const adminEmail = `e2e-order-cancel-admin-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(page, adminEmail);

    await page.goto(`/admin/porudzbine/detalji/${order._id.toString()}`);
    await page.getByRole("button", { name: "Otkaži porudžbinu" }).click();

    // "cancelled" needsReason: true (see order.presenter.js) - a different modal
    // shape than the plain data-confirm actions elsewhere (order-status-actions.ejs's
    // needsReason branch): a real form with a reason textarea, submitted directly
    // from inside the now-visible modal, not confirmActionModal's #confirmActionButton
    const modal = page.locator(".modal.show");
    await expect(modal).toBeVisible();
    await modal.locator('textarea[name="reason"]').fill("E2E test otkazivanje");
    await modal.getByRole("button", { name: "Potvrdi" }).click();
    await expectFlashSuccess(page);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe("cancelled");

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variations[0].stock).toBe(5); // 3 + the 2 units this order held
  });

  test("marking a delivered order as returned also restores its stock", async ({ page }) => {
    const product = await seedProduct({ price: 1500, stock: 4 });
    const customer = await seedCustomer();
    await Product.updateOne({ _id: product._id }, { $set: { "variations.0.stock": 3 } });
    // seeded already at "delivered" - "returned" is only reachable from there (see
    // order-status-transitions.js), and the prior shipped->delivered step is
    // already implicitly covered by order-completion-commission.spec.js's full walk
    const order = await seedOrder({ customer, status: "delivered", subtotal: 1500, product, quantity: 1 });

    const adminEmail = `e2e-order-return-admin-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(page, adminEmail);

    await page.goto(`/admin/porudzbine/detalji/${order._id.toString()}`);
    await page.getByRole("button", { name: "Označi kao vraćeno" }).click();
    const modal = page.locator(".modal.show");
    await expect(modal).toBeVisible();
    await modal.locator('textarea[name="reason"]').fill("Kupac vratio proizvod");
    await modal.getByRole("button", { name: "Potvrdi" }).click();
    await expectFlashSuccess(page);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe("returned");

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variations[0].stock).toBe(4); // 3 + the 1 unit this order held
  });
});