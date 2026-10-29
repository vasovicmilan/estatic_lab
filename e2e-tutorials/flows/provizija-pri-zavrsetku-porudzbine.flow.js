import { expect } from "../scripts/tutorial.fixture.js";
import { seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, searchAndOpenAdminRecord, clickVisibly } from "../scripts/slow-actions.js";
import { seedCustomer, seedOrder, seedPartner, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import CommissionEntry from "../../src/models/commission-entry.model.js";

/**
 * Shared flow of "provizija-pri-zavrsetku-porudzbine" / "-mobilni". A partner's commission on an
 * order stays "pending" while the order is processed, shipped and delivered, and becomes
 * "earned" only when an admin marks the order completed. Admin only, one actor; the order and its
 * pending commission are seeded, the status changes are done by clicking the real buttons.
 */
export async function run({ page, tut, mobile }) {
  const { partner } = await seedPartner({ commissionRateProducts: 5 });
  const customer = await seedCustomer();
  const order = await seedOrder({ customer, status: "pending", subtotal: 10000 });
  const entry = await seedCommissionEntry({ earnerType: "partner", partner, order, sourceType: "order", status: "pending", amount: 500, rate: 5 });

  const adminEmail = `tutorial-order-completion-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: customer.email, stepIdPrefix: "admin-porudzbine", mobile });
  await expect(page.getByRole("button", { name: "Označi kao u obradi" })).toBeVisible();

  for (const [id, label] of [
    ["oznacavanje-u-obradi", "Označi kao u obradi"],
    ["oznacavanje-poslato", "Označi kao poslato"],
    ["oznacavanje-dostavljeno", "Označi kao dostavljeno"],
  ]) {
    await tut.step(id, async () => {
      await clickVisibly(page.getByRole("button", { name: label }), { mobile });
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });
  }

  const stillPending = await CommissionEntry.findById(entry._id);
  expect(stillPending.status).toBe("pending");

  await tut.step("oznacavanje-zavrseno", async () => {
    await clickVisibly(page.getByRole("button", { name: "Označi kao završeno" }), { mobile });
    await confirmActionModal(page);
    await expectFlashSuccess(page);
  });

  await expect
    .poll(async () => (await CommissionEntry.findById(entry._id)).status, { timeout: 10_000 })
    .toBe("earned");
  const final = await CommissionEntry.findById(entry._id);
  expect(final.earnedAt).toBeTruthy();
}
