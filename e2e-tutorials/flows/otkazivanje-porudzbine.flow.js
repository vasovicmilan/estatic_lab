import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import { seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, searchAndOpenAdminRecord, clickVisibly } from "../scripts/slow-actions.js";
import { seedCustomer, seedProduct, seedOrder, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import Product from "../../src/models/product.model.js";
import Order from "../../src/models/order.model.js";

/**
 * Shared flow of "otkazivanje-porudzbine" / "otkazivanje-porudzbine-mobilni". The subject is the
 * cancellation MODAL: unlike the plain "are you sure?" confirms elsewhere in the admin, cancelling
 * an order asks for a written reason first (order-status-actions.ejs's needsReason branch) and,
 * invisibly, puts the product stock back (order.service.js's transitionStatus ->
 * restoreVariationStock). Admin only, one actor: home -> "Prijava" -> login -> account menu ->
 * "Admin panel" -> "Prodavnica" > "Porudžbine" -> search -> open -> cancel.
 */
export async function run({ page, tut, mobile }) {
  const product = await seedProduct({ price: 2000, stock: 5 });
  const customer = await seedCustomer();
  // 2 pieces were already taken off the stock at checkout (temporary-order.service.js's
  // decreaseVariationStock) - the seeded order stands for that, stock is now 3
  await Product.updateOne({ _id: product._id }, { $set: { "variations.0.stock": 3 } });
  const order = await seedOrder({ customer, status: "pending", subtotal: 4000, product, quantity: 2 });

  const adminEmail = `tutorial-order-cancel-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: customer.email, stepIdPrefix: "admin-porudzbine", mobile });

  await tut.step("otvaranje-modala-za-otkazivanje", async () => {
    await clickVisibly(page.getByRole("button", { name: "Otkaži porudžbinu" }), { mobile });
    await expect(page.locator(".modal.show")).toBeVisible();
  });

  await tut.step("unos-razloga", async () => {
    await typeSlowly(page.locator(".modal.show").locator('textarea[name="reason"]'), "Kupac je odustao od porudžbine");
  });

  await tut.step("potvrda-otkazivanja", async () => {
    await page.locator(".modal.show").getByRole("button", { name: "Potvrdi" }).click();
    await expectFlashSuccess(page);
  });

  const updatedOrder = await Order.findById(order._id);
  expect(updatedOrder.status).toBe("cancelled");
  const updatedProduct = await Product.findById(product._id);
  expect(updatedProduct.variations[0].stock).toBe(5); // 3 + 2 given back by the cancelled order
}
