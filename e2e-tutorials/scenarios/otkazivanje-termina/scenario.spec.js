import { test, expect } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly } from "../../scripts/slow-actions.js";
import { seedService, seedAppointment, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * customer-self-service.spec.js's first case. The appointment itself is seeded
 * directly (bypassing the booking UI, same as the real e2e spec) rather than
 * booked live - this tutorial's subject is the self-service account area
 * (viewing, then cancelling, an EXISTING appointment), not the booking flow
 * itself, which already has its own tutorial (zakazivanje-termina). Keeping this
 * one focused avoids re-narrating the same booking steps twice.
 */
test.describe("Tutorial: otkazivanje termina", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("klijent vidi i otkazuje sopstveni termin iz naloga", async ({ page, tut }) => {
    const service = await seedService({ price: 2500, duration: 30 });
    const customerEmail = `tutorial-cancel-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Sofija", lastName: "Nikolić" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    const { default: User } = await import("../../../src/models/user.model.js");
    const customer = await User.findOne({ email: customerEmail });
    // 3 dana unapred - udobno prošla 24h granica za otkazivanje od strane
    // klijenta (USER_CANCELLATION_CUTOFF_HOURS, videti appointment-cancellation.util.js)
    const appointment = await seedAppointment({ service, status: "confirmed", customer, daysAhead: 3 });

    await tut.step("pregled-termina", async () => {
      await page.goto("/nalog/termini");
      await expect(page.getByText("Standard")).toBeVisible();
    });

    await tut.step("otvaranje-detalja-termina", async () => {
      await page.goto(`/nalog/termini/detalji/${appointment._id.toString()}`);
      await expect(page.getByRole("button", { name: "Otkaži termin" })).toBeVisible();
    });

    await tut.step("otkazivanje-termina", async () => {
      await page.getByRole("button", { name: "Otkaži termin" }).click();
      await confirmActionModal(page);
      await expectFlashSuccess(page);
    });

    const { default: Appointment } = await import("../../../src/models/appointment.model.js");
    const updated = await Appointment.findById(appointment._id);
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledBy).toBe("user");
  });
});
