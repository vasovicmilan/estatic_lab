import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedCustomer,
  seedOrder,
  seedPartner,
  seedCommissionEntry,
  confirmActionModal,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import CommissionEntry from "../../src/models/commission-entry.model.js";

/**
 * End-to-end coverage for the second half of the order-commission lifecycle -
 * coupon-product-discount.spec.js already covers the FIRST half (an order
 * confirmation creates a "pending" partner commission entry), but nothing has ever
 * exercised the promotion from "pending" to "earned" that's supposed to happen
 * once an admin walks the order all the way to "completed" - see
 * commission.listener.js's order:status_changed handler and
 * commission.service.js's promoteOrderCommissionOnCompletion. A pending commission
 * that never gets promoted is money a partner earned but the payout system would
 * never let them actually request, so this gap mattered.
 */
test.describe("Order completion promotes its partner commission from pending to earned", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("commission stays pending through processing/shipped/delivered, and only becomes earned once the order is marked completed", async ({ page }) => {
    const { partner } = await seedPartner({ commissionRateProducts: 5 });
    const customer = await seedCustomer();
    const order = await seedOrder({ customer, status: "pending", subtotal: 10000 });
    const entry = await seedCommissionEntry({ earnerType: "partner", partner, order, sourceType: "order", status: "pending", amount: 500, rate: 5 });

    const adminEmail = `e2e-order-completion-admin-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(page, adminEmail);

    await page.goto(`/admin/porudzbine/detalji/${order._id.toString()}`);
    await page.getByRole("button", { name: "Označi kao u obradi" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    await page.getByRole("button", { name: "Označi kao poslato" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    await page.getByRole("button", { name: "Označi kao dostavljeno" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    // still pending - "delivered" is not "completed", and only "completed" should
    // trigger the promotion (see commission.listener.js's explicit status check)
    let current = await CommissionEntry.findById(entry._id);
    expect(current.status).toBe("pending");

    await page.getByRole("button", { name: "Označi kao završeno" }).click();
    await confirmActionModal(page);
    await expectFlashSuccess(page);

    // order:status_changed's listener runs asynchronously after the HTTP response
    // (see commission.listener.js), same reasoning as the other commission specs
    await expect
      .poll(async () => {
        const found = await CommissionEntry.findById(entry._id);
        return found.status;
      }, { timeout: 10_000 })
      .toBe("earned");

    current = await CommissionEntry.findById(entry._id);
    expect(current.earnedAt).toBeTruthy();
  });
});