import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  loginViaUI,
  registerAndLoginViaUI,
  promoteToAdmin,
  seedEmployee,
  seedPartner,
  seedCommissionEntry,
  confirmActionModal,
  expectFlashSuccess,
} from "./helpers/e2e-helpers.js";
import PayoutRequest from "../../src/models/payout-request.model.js";

/**
 * End-to-end coverage for the full payout lifecycle: an employee requests a payout
 * against their earned balance through their own dashboard, an admin approves it,
 * then marks it paid - the same status machine payout-request.service.test.js
 * already covers at the unit level, but never driven through the real forms,
 * balance-guard validation, and admin/employee UI before now.
 */
test.describe("Payout request lifecycle", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("employee requests a payout, admin approves it, then marks it paid", async ({ page, browser }) => {
    test.slow(); // two-page flow, same reasoning as the other multi-actor specs

    const { user: employeeUser, employee } = await seedEmployee({ commissionRate: 20 });
    await seedCommissionEntry({ earnerType: "employee", employee, amount: 3000, rate: 20 });

    await loginViaUI(page, { email: employeeUser.email });

    await page.goto("/moj-nalog");
    await expect(page.getByText("3000").first()).toBeVisible();

    await page.fill('input[name="amount"]', "2000");
    await page.getByRole("button", { name: "Pošalji zahtev" }).click();
    await expectFlashSuccess(page);

    let request = await PayoutRequest.findOne({ employee: employee._id }).sort({ createdAt: -1 });
    expect(request.status).toBe("requested");
    expect(request.amount).toBe(2000);

    // 3000 earned - 2000 now reserved by the pending request above = 1000 left.
    // The form's own `max` attribute reflects that remaining balance (see
    // dashboard.ejs), which the browser enforces before a request could ever
    // reach the server - so this checks the UI surfaces the real number rather
    // than trying to force a submission past it (payout-request.service.test.js's
    // unit tests already cover the server-side guard itself in isolation).
    await page.goto("/moj-nalog");
    await expect(page.locator('input[name="amount"]')).toHaveAttribute("max", "1000");

    // --- admin: approve, then mark paid ---
    const adminEmail = `e2e-payout-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto(`/admin/isplate/detalji/${request._id.toString()}`);
    await adminPage.getByRole("button", { name: "Odobri" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    request = await PayoutRequest.findById(request._id);
    expect(request.status).toBe("approved");
    expect(request.approvedAt).toBeTruthy();

    await adminPage.getByRole("button", { name: "Označi kao isplaćeno" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    request = await PayoutRequest.findById(request._id);
    expect(request.status).toBe("paid");
    expect(request.paidAt).toBeTruthy();

    // "Isplaćeno" also appears as a <option> in the status filter dropdown and as
    // a hidden mobile-card badge (see payouts.ejs's d-lg-none/d-none-d-lg-block
    // pattern) - the table cell role specifically hits only the visible desktop row
    await page.goto("/moj-nalog/isplate");
    await expect(page.getByRole("cell", { name: "Isplaćeno" })).toBeVisible();

    await adminContext.close();
  });

  test("admin rejects a requested payout", async ({ page, browser }) => {
    const { user: employeeUser, employee } = await seedEmployee({ commissionRate: 20 });
    await seedCommissionEntry({ earnerType: "employee", employee, amount: 1000, rate: 20 });

    await loginViaUI(page, { email: employeeUser.email });
    await page.goto("/moj-nalog");
    await page.fill('input[name="amount"]', "1000");
    await page.getByRole("button", { name: "Pošalji zahtev" }).click();

    const request = await PayoutRequest.findOne({ employee: employee._id }).sort({ createdAt: -1 });

    const adminEmail = `e2e-payout-reject-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto(`/admin/isplate/detalji/${request._id.toString()}`);
    await adminPage.getByRole("button", { name: "Odbij" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    const updated = await PayoutRequest.findById(request._id);
    expect(updated.status).toBe("rejected");
    expect(updated.rejectedAt).toBeTruthy();

    await adminContext.close();
  });

  test("partner requests a payout through their own dashboard, and the admin approves + marks it paid", async ({ page, browser }) => {
    test.slow(); // two-page flow, same reasoning as the other multi-actor specs

    // deliberately mismatched services/products rates - not directly asserted here
    // (that's coupon-product-discount.spec.js / booking-appointment-commission.spec.js's
    // job), just confirming the payout side works identically for a partner earner
    // as it does for an employee one, through the partner's OWN dashboard
    // (/moj-partner-nalog, a completely separate controller from /moj-nalog)
    const { user: partnerUser, partner } = await seedPartner({ commissionRateServices: 10, commissionRateProducts: 5 });
    await seedCommissionEntry({ earnerType: "partner", partner, amount: 2000, rate: 10 });

    await loginViaUI(page, { email: partnerUser.email });

    await page.goto("/moj-partner-nalog");
    await expect(page.getByText("2000").first()).toBeVisible();

    await page.fill('input[name="amount"]', "2000");
    await page.getByRole("button", { name: "Pošalji zahtev" }).click();
    await expectFlashSuccess(page);

    let request = await PayoutRequest.findOne({ partner: partner._id }).sort({ createdAt: -1 });
    expect(request.earnerType).toBe("partner");
    expect(request.status).toBe("requested");
    expect(request.amount).toBe(2000);

    const adminEmail = `e2e-partner-payout-admin-${Date.now()}@example.com`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto(`/admin/isplate/detalji/${request._id.toString()}`);
    await adminPage.getByRole("button", { name: "Odobri" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    await adminPage.getByRole("button", { name: "Označi kao isplaćeno" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    request = await PayoutRequest.findById(request._id);
    expect(request.status).toBe("paid");
    expect(request.paidAt).toBeTruthy();

    // the partner's own history should reflect it too, not just the DB - scoped to
    // the table cell role since "Isplaćeno" also appears as a filter <option> and
    // as a hidden mobile-card duplicate (same responsive pattern as employee's
    // payouts.ejs)
    await page.goto("/moj-partner-nalog/isplate");
    await expect(page.getByRole("cell", { name: "Isplaćeno" })).toBeVisible();

    await adminContext.close();
  });
});