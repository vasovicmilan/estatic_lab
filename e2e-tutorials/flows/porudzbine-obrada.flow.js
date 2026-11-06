import { expect, newRecordedContext, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickAdminCreateButton, searchAndOpenAdminRecord,
  clickVisibly, scrollToSmoothly, scrollToTop, highlight, uploadFileVisibly, selectOptionVisibly,
} from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import path from "path";
import { fileURLToPath } from "url";
import { seedCustomer, seedOrder, confirmActionModal } from "../../test/e2e/helpers/e2e-helpers.js";
import Order from "../../src/models/order.model.js";

/**
 * Shared flow of "porudzbine-obrada" / "-mobilni" - an admin takes an order through
 * processing -> shipped -> delivered -> completed.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const lastName = `Porudzbina${suffix}`;
  const customer = await seedCustomer({ email: `tutorial-porudzbine-${suffix}@example.com` });
  customer.lastName = lastName;
  await customer.save();
  const order = await seedOrder({ customer, status: "pending", subtotal: 6200 });

  const adminEmail = `tutorial-porudzbine-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine", mobile });
  await searchAndOpenAdminRecord(page, tut, undefined, { searchValue: lastName, stepIdPrefix: "admin-porudzbine", mobile });

  const advance = async (id, label) => {
    await tut.step(id, async () => {
      const button = page.getByRole("button", { name: label });
      await scrollToSmoothly(button);
      await clickVisibly(button, { mobile });
      await confirmActionModal(page);
      await page.waitForLoadState("networkidle");
      await expectFlashSuccess(page);
    });
  };

  await tut.step("porudzbina-pregled", async () => {
    await highlight(page.getByRole("button", { name: "Označi kao u obradi" }));
  });
  await advance("porudzbina-obrada", "Označi kao u obradi");
  await advance("porudzbina-slanje", "Označi kao poslato");
  await advance("porudzbina-dostava", "Označi kao dostavljeno");
  await advance("porudzbina-zavrsetak", "Označi kao završeno");

  const updated = await Order.findById(order._id);
  expect(updated.status).toBe("completed");
}
