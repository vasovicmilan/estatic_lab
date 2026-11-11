import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, scrollToSmoothly, scrollToTop, focusIfPresent,
} from "../scripts/slow-actions.js";
import AuditLog from "../../src/models/audit-log.model.js";
import UserActivityLog from "../../src/models/user-activity-log.model.js";

async function clickLink(page, locator) {
  const link = locator.locator("visible=true").first();
  await scrollToSmoothly(link);
  await link.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Shared flow of "logovi-i-audit" / "-mobilni" - explanatory tour of the whole "Sistem > Logovi" area:
 * the live log dashboard, the audit log (who changed what), the user activity log (what customers do
 * on the site) and the history of daily summaries. Nothing is changed; a few log rows are seeded
 * directly so the tables are not empty on a fresh tutorial database.
 */
export async function run({ page, tut, mobile }) {
  const adminEmail = `tutorial-logovi-admin-${Date.now()}@example.com`;
  const admin = await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  const now = Date.now();
  await AuditLog.insertMany([
    { timestamp: new Date(now - 3600e3), actor: { id: admin._id, email: adminEmail, role: "admin" }, action: "COUPON_CREATED", entity: { type: "Coupon", id: "demo" }, changes: { discountValue: { old: null, new: 15 } }, ip: "127.0.0.1", success: true },
    { timestamp: new Date(now - 2400e3), actor: { id: admin._id, email: adminEmail, role: "admin" }, action: "PRODUCT_UPDATED", entity: { type: "Product", id: "demo" }, changes: { price: { old: 2990, new: 2490 } }, ip: "127.0.0.1", success: true },
    { timestamp: new Date(now - 1200e3), actor: { id: admin._id, email: adminEmail, role: "admin" }, action: "ORDER_STATUS_CHANGED", entity: { type: "Order", id: "demo" }, changes: { status: { old: "pending", new: "confirmed" } }, ip: "127.0.0.1", success: true },
  ]);
  await UserActivityLog.insertMany([
    { timestamp: new Date(now - 3000e3), role: "guest", action: "CART_ITEM_ADDED", entity: { type: "Product", id: "demo" }, ip: "127.0.0.1", success: true },
    { timestamp: new Date(now - 1800e3), role: "user", action: "APPOINTMENT_BOOKED", entity: { type: "Service", id: "demo" }, ip: "127.0.0.1", success: true },
  ]);

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sistem", itemLabel: "Logovi", stepIdPrefix: "admin-logovi", mobile });

  await tut.step("logovi-dashboard", async () => {
    await expect(page).toHaveURL(/\/admin\/logovi/);
    await scrollToTop(page);
    await focusIfPresent(page.locator("h1").first());
  });
  await tut.step("logovi-greske", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Najčešće greške" }));
  });
  await tut.step("logovi-rute", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Najposećenije rute" }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Rute sa 4xx/5xx" }));
  });

  // --- audit log ---
  await tut.step("audit-klik", async () => {
    await scrollToTop(page);
    await clickLink(page, page.getByRole("link", { name: /Audit log/ }));
    await expect(page).toHaveURL(/\/admin\/logovi\/audit/);
  });
  await tut.step("audit-tabela", async () => {
    await focusIfPresent(page.locator("table").first());
  });
  await tut.step("audit-izmene", async () => {
    await focusIfPresent(page.getByText("COUPON_CREATED").first());
  });
  await tut.step("audit-filteri", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.locator('form[action="/admin/logovi/audit"]'));
  });
  await tut.step("audit-pretraga", async () => {
    const search = page.locator('form[action="/admin/logovi/audit"] input[name="search"]');
    await typeSlowly(search, adminEmail.slice(0, 14));
    await search.press("Enter");
    await page.waitForLoadState("networkidle");
  });

  // --- user activity ---
  await tut.step("aktivnost-nazad", async () => {
    await page.goto("/admin/logovi");
    await expect(page).toHaveURL(/\/admin\/logovi$/);
  });
  await tut.step("aktivnost-klik", async () => {
    await clickLink(page, page.getByRole("link", { name: /Aktivnost korisnika/ }));
    await expect(page).toHaveURL(/\/admin\/logovi\/aktivnost/);
  });
  await tut.step("aktivnost-statistika", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Akcije po učestalosti" }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Najviše zakazivane usluge" }));
  });
  await tut.step("aktivnost-tabela", async () => {
    await focusIfPresent(page.locator("table").first());
  });

  // --- daily history ---
  await tut.step("istorija-nazad", async () => {
    await page.goto("/admin/logovi");
    await expect(page).toHaveURL(/\/admin\/logovi$/);
  });
  await tut.step("istorija-klik", async () => {
    await clickLink(page, page.getByRole("link", { name: /Istorija dnevnih izveštaja/ }));
    await expect(page).toHaveURL(/\/admin\/logovi\/istorija/);
  });
  await tut.step("istorija-pregled", async () => {
    await expect(page.locator("main")).toBeVisible();
    await focusIfPresent(page.locator("h1").first());
  });
}
