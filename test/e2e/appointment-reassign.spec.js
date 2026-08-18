import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import { registerAndLoginViaUI, promoteToAdmin, seedService, seedEmployee, seedAppointment, expectFlashSuccess } from "./helpers/e2e-helpers.js";
import Appointment from "../../src/models/appointment.model.js";

/**
 * End-to-end coverage for an admin reassigning an appointment to a different
 * employee (appointment.service.js's reassignAppointment) - never exercised
 * through a real browser before this suite existed. The reassignment dropdown
 * itself is pre-filtered to only list employees who'd actually pass the working-
 * hours and overlap checks (see appointment.controller.js's eligibleIds filter) -
 * so an already-double-booked employee is never even offered as an option, rather
 * than being selectable and then rejected on submit. This tests THAT filtering
 * directly, since it's the actual observable behavior a real admin would hit.
 */
test.describe("Admin reassigns an appointment to a different employee", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("reassigns to a free employee; an employee already booked at the exact same time is never even offered as an option", async ({ page }) => {
    const service = await seedService({ price: 3000, duration: 30 });
    const { employee: employeeA, user: userA } = await seedEmployee({ service });
    const { employee: employeeB, user: userB } = await seedEmployee({ service });
    const { employee: employeeC } = await seedEmployee({ service });

    const appointment = await seedAppointment({ service, employeeRecord: employeeA, employeeUser: userA, status: "confirmed", daysAhead: 2 });
    // employee B already has something else booked at the EXACT same time - the
    // overlap this test's second half is actually checking for
    await seedAppointment({ service, employeeRecord: employeeB, employeeUser: userB, status: "confirmed", daysAhead: 2 });

    const adminEmail = `e2e-reassign-admin-${Date.now()}@example.com`;
    await registerAndLoginViaUI(page, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(page, adminEmail);

    await page.goto(`/admin/termini/detalji/${appointment._id.toString()}`);

    // --- reassigning to employee C (free at this time) succeeds ---
    await page.locator("#assignEmployeeSelect").selectOption(employeeC._id.toString());
    await page.getByRole("button", { name: "Promeni" }).click();
    await expectFlashSuccess(page);

    let updated = await Appointment.findById(appointment._id);
    expect(updated.employee.toString()).toBe(employeeC._id.toString());

    // --- employee B (already double-booked at this exact time) never even
    // appears as a selectable option - the dropdown is pre-filtered server-side
    // (see appointment.controller.js's eligibleIds filter using
    // availability.service.js's getEligibleEmployeeIdsForAppointment), so there's
    // no "select B and get rejected" path to click through - the UI simply never
    // offers an action the server would then refuse
    await page.goto(`/admin/termini/detalji/${appointment._id.toString()}`);
    await expect(page.locator(`#assignEmployeeSelect option[value="${employeeB._id.toString()}"]`)).toHaveCount(0);

    // employee A (the original assignee, now free again since the appointment
    // moved to C) should still be offered
    await expect(page.locator(`#assignEmployeeSelect option[value="${employeeA._id.toString()}"]`)).toHaveCount(1);
  });
});