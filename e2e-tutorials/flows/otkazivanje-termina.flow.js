import { expect } from "../scripts/tutorial.fixture.js";
import { registerViaNavSlowly, fillLoginFormSlowly, openAccountMenuItem, openListedItem, clickVisibly } from "../scripts/slow-actions.js";
import { seedService, seedAppointment, confirmActionModal, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "otkazivanje-termina" / "otkazivanje-termina-mobilni". The appointment is
 * seeded directly (same as the real e2e spec) - this tutorial's subject is the customer's
 * self-service area, not the booking flow (that has its own tutorial). Reached by clicking:
 * account menu -> "Moji termini" -> the appointment in the list -> "Otkaži termin".
 */
export async function run({ page, tut, mobile }) {
  const service = await seedService({ price: 2500, duration: 30 });
  const customerEmail = `tutorial-cancel-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Sofija", lastName: "Nikolić" });

  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  const { default: User } = await import("../../src/models/user.model.js");
  const customer = await User.findOne({ email: customerEmail });
  // 3 days ahead - comfortably past the 24h cut-off for a customer's own cancellation
  // (USER_CANCELLATION_CUTOFF_HOURS, see appointment-cancellation.util.js)
  const appointment = await seedAppointment({ service, status: "confirmed", customer, daysAhead: 3 });

  await openAccountMenuItem(page, tut, { mobile, href: "/nalog/termini", stepIdPrefix: "nalog-termini" });

  await tut.step("pregled-termina", async () => {
    await expect(page.getByText("Standard").locator("visible=true").first()).toBeVisible();
  });

  await openListedItem(page, tut, { mobile, href: `/nalog/termini/detalji/${appointment._id.toString()}`, id: "otvaranje-detalja-termina" });
  await expect(page.getByRole("button", { name: "Otkaži termin" })).toBeVisible();

  await tut.step("otkazivanje-termina", async () => {
    await clickVisibly(page.getByRole("button", { name: "Otkaži termin" }), { mobile });
    await confirmActionModal(page);
    await expectFlashSuccess(page);
  });

  const { default: Appointment } = await import("../../src/models/appointment.model.js");
  const updated = await Appointment.findById(appointment._id);
  expect(updated.status).toBe("cancelled");
  expect(updated.cancelledBy).toBe("user");
}
