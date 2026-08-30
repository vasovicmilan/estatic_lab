import { test, expect } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedCustomer, seedOrder, seedPartner, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import CommissionEntry from "../../../src/models/commission-entry.model.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * order-completion-commission.spec.js. Worth showing on its own because the rule
 * itself is easy to get wrong as a business owner's mental model: a partner's
 * referral commission on an order is only "earned" (payout-eligible) once the
 * order reaches "completed" - NOT "delivered". A commission sitting at
 * "pending" through processing/shipped/delivered and only flipping at the very
 * last status is the actual behavior worth walking someone through, since
 * "delivered" sounds done but isn't the trigger.
 */
test.describe("Tutorial: provizija se obračunava tek pri završetku porudžbine", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("provizija ostaje na čekanju kroz obradu/slanje/dostavu, i tek pri završetku postaje zarađena", async ({ page, tut }) => {
    const { partner } = await seedPartner({ commissionRateProducts: 5 });
    const customer = await seedCustomer();
    const order = await seedOrder({ customer, status: "pending", subtotal: 10000 });
    const entry = await seedCommissionEntry({ earnerType: "partner", partner, order, sourceType: "order", status: "pending", amount: 500, rate: 5 });

    const adminEmail = `tutorial-order-completion-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine" });
    await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: customer.email, stepIdPrefix: "admin-porudzbine" });
    await expect(page.getByRole("button", { name: "Označi kao u obradi" })).toBeVisible();

    await tut.step("oznacavanje-u-obradi", async () => {
      await page.getByRole("button", { name: "Označi kao u obradi" }).click();
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });

    await tut.step("oznacavanje-poslato", async () => {
      await page.getByRole("button", { name: "Označi kao poslato" }).click();
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });

    await tut.step("oznacavanje-dostavljeno", async () => {
      await page.getByRole("button", { name: "Označi kao dostavljeno" }).click();
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });

    // i dalje na čekanju - "dostavljeno" nije "završeno", i samo "završeno"
    // pokreće unapređenje provizije (videti commission.listener.js)
    const stillPending = await CommissionEntry.findById(entry._id);
    expect(stillPending.status).toBe("pending");

    await tut.step("oznacavanje-zavrseno", async () => {
      await page.getByRole("button", { name: "Označi kao završeno" }).click();
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });

    // order:status_changed's listener runs asynchronously after the HTTP response
    await expect
      .poll(async () => {
        const found = await CommissionEntry.findById(entry._id);
        return found.status;
      }, { timeout: 10_000 })
      .toBe("earned");

    const final = await CommissionEntry.findById(entry._id);
    expect(final.earnedAt).toBeTruthy();
  });
});
