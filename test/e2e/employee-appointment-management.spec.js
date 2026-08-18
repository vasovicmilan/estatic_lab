import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  loginViaUI,
  seedService,
  seedEmployee,
  seedAppointment,
  findCommissionEntriesForAppointment,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";

/**
 * End-to-end coverage for an employee managing their OWN assigned appointments
 * through /moj-nalog - a completely separate controller/view path
 * (employee.controller.js) from the admin panel's equivalent actions, which
 * booking-appointment-commission.spec.js already covers. Same underlying
 * appointmentService.confirmAppointment/completeAppointment functions, but this is
 * the only place that exercises the employee-role branch of canAccessAppointment
 * (an employee can only act on their OWN appointments) and the employee's own
 * self-service UI end to end.
 */
test.describe("Employee self-service - managing assigned appointments", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("an employee sees their assigned appointment, confirms it, completes it, and earns a commission entry", async ({ page }) => {
    const service = await seedService({ price: 3500, duration: 45 });
    const { user: employeeUser, employee } = await seedEmployee({ service, commissionRate: 30 });
    const appointment = await seedAppointment({
      service,
      employeeRecord: employee,
      employeeUser,
      status: "pending",
    });

    await loginViaUI(page, { email: employeeUser.email });

    await page.goto("/moj-nalog/termini");
    await expect(page.getByText("Standard")).toBeVisible();

    await page.goto(`/moj-nalog/termini/detalji/${appointment._id.toString()}`);
    await page.getByRole("button", { name: "Potvrdi" }).click();
    await expectFlashSuccess(page);

    await page.getByRole("button", { name: "Označi kao završen" }).click();
    await expectFlashSuccess(page);

    // appointment:status_changed's commission-recording listener runs
    // asynchronously after the HTTP response (see commission.listener.js)
    await expect
      .poll(async () => {
        const entries = await findCommissionEntriesForAppointment(appointment._id);
        return entries.length;
      }, { timeout: 10_000 })
      .toBe(1);

    const [entry] = await findCommissionEntriesForAppointment(appointment._id);
    expect(entry.earnerType).toBe("employee");
    expect(entry.rate).toBe(30);
    expect(entry.status).toBe("earned");

    // rendered twice (mobile card list + desktop table, one hidden per viewport via
    // Bootstrap's d-lg-none/d-none-d-lg-block - see commissions.ejs) - scoping to
    // the table cell role specifically hits only the visible desktop copy
    await page.goto("/moj-nalog/provizije");
    await expect(page.getByRole("cell", { name: "30%" })).toBeVisible();
  });

  test("an employee cannot see or act on an appointment assigned to someone else", async ({ page }) => {
    const service = await seedService({ price: 2000, duration: 30 });
    const { employee: otherEmployeeRecord } = await seedEmployee({ service, commissionRate: 15 });
    const { user: thisEmployeeUser } = await seedEmployee({ service, commissionRate: 15 });
    const appointment = await seedAppointment({ service, employeeRecord: otherEmployeeRecord, status: "pending" });

    await loginViaUI(page, { email: thisEmployeeUser.email });
    await page.goto(`/moj-nalog/termini/detalji/${appointment._id.toString()}`);

    // canAccessAppointment's employee-role branch rejects this - see
    // appointment.service.js's getAppointmentById
    await expect(page.getByText(/nemate pristup/i)).toBeVisible();
  });
});