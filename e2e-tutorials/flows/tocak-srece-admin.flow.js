import { expect } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, scrollToSmoothly, scrollToTop, focusIfPresent,
} from "../scripts/slow-actions.js";
import wheelService from "../../src/services/wheel.service.js";
import { ensureWheelServices, randomPhone } from "./tocak-srece-posetilac.flow.js";

async function clickLink(page, locator) {
  const link = locator.locator("visible=true").first();
  await scrollToSmoothly(link);
  await link.click({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Shared flow of "tocak-srece-admin" / "-mobilni" - the owner's side of the fair wheel: the list of
 * contacts that left their data, one contact in detail, the prizes with their stock and the QR code,
 * the separate view of the single-use coupons, and the CSV export. A few visitors are "spun" directly
 * through the service beforehand so the lists are not empty.
 */
export async function run({ page, tut, mobile }) {
  const suffix = Date.now();
  const adminEmail = `tutorial-tocak-admin-${suffix}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  await ensureWheelServices();
  for (const [i, segment] of ["usluge", "kozmetika", "b2b"].entries()) {
    try {
      await wheelService.spin({
        firstName: ["Ana", "Marko", "Ivana"][i], lastName: "Sajam", email: `tutorial-tocak-lead-${suffix}-${i}@example.com`,
        phone: randomPhone(), segment, consentContact: true, consentMarketing: i !== 1, source: "sajam-demo",
      });
    } catch (e) {
      console.warn("[tutorial] wheel seed spin failed:", e.message);
    }
  }

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Točak sreće", stepIdPrefix: "admin-tocak", mobile });

  await tut.step("tocak-kontakti", async () => {
    await expect(page).toHaveURL(/\/admin\/tocak/);
    await focusIfPresent(page.locator("table").first());
  });
  await tut.step("tocak-filteri", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.locator('select[name="segment"]'));
    await focusIfPresent(page.locator('select[name="source"]'));
  });
  await tut.step("tocak-detalji", async () => {
    const view = page.locator('a[href^="/admin/tocak/detalji/"]').locator("visible=true").first();
    await scrollToSmoothly(view);
    await view.click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/admin\/tocak\/detalji\//);
    await focusIfPresent(page.locator("main .card").first());
  });

  await tut.step("tocak-nagrade-klik", async () => {
    await page.goto("/admin/tocak");
    await clickLink(page, page.getByRole("link", { name: /Nagrade, QR i izvoz/ }));
    await expect(page).toHaveURL(/\/admin\/tocak\/nagrade/);
  });
  await tut.step("tocak-nagrade-tabela", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Nagrade" }));
    await focusIfPresent(page.locator("table").first());
  });
  await tut.step("tocak-nagrada-dodavanje", async () => {
    await scrollToTop(page);
    await clickLink(page, page.getByRole("link", { name: /Dodaj nagradu/ }));
    await expect(page).toHaveURL(/\/admin\/tocak\/nagrade\/nova/);
    await focusIfPresent(page.locator("#label"));
  });
  await tut.step("tocak-nagrada-forma", async () => {
    await page.locator("#label").fill("Besplatna konsultacija");
    await page.locator("#shortLabel").fill("Konsultacija");
    await page.locator("#discountValue").fill("100");
    await page.locator("#weight").fill("5");
    await page.locator("#stock").fill("10");
    await focusIfPresent(page.locator('[data-field-wrapper="serviceSlugs"]'));
    await focusIfPresent(page.locator('[data-field-wrapper="isFallback"]'));
  });
  await tut.step("tocak-nagrada-cuvanje", async () => {
    const save = page.getByRole("button", { name: "Dodaj nagradu" });
    await scrollToSmoothly(save);
    await save.click({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/admin\/tocak\/nagrade$/);
    await focusIfPresent(page.getByRole("row", { name: /Besplatna konsultacija/ }));
  });
  await tut.step("tocak-nagrada-izmena", async () => {
    const row = page.getByRole("row", { name: /Besplatna konsultacija/ });
    await clickLink(page, row.getByRole("link", { name: "Izmeni" }));
    await expect(page).toHaveURL(/\/admin\/tocak\/nagrade\/[a-f0-9]{24}\/izmena/);
    await focusIfPresent(page.locator("#discountValue"));
    await focusIfPresent(page.locator("#isActive"));
  });
  await tut.step("tocak-nagrada-odustani", async () => {
    await clickLink(page, page.getByRole("link", { name: "Odustani" }));
    await expect(page).toHaveURL(/\/admin\/tocak\/nagrade$/);
  });
  await tut.step("tocak-nagrada-brisanje", async () => {
    // never awarded, so it can still be removed; the trash button asks for confirmation first
    const row = page.getByRole("row", { name: /Besplatna konsultacija/ });
    await focusIfPresent(row.locator('button[title="Briše nagradu sa točka"]'));
  });

  await tut.step("tocak-qr", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "QR kod za štampu" }));
    await focusIfPresent(page.locator('a[href^="/admin/tocak/qr.png"]'));
  });
  await tut.step("tocak-izvoz", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.locator('a[href="/admin/tocak/izvoz.csv"]'));
  });

  await tut.step("tocak-kuponi-klik", async () => {
    await clickLink(page, page.getByRole("link", { name: /Kuponi/ }));
    await expect(page).toHaveURL(/\/admin\/tocak\/kuponi/);
  });
  await tut.step("tocak-kuponi-lista", async () => {
    await focusIfPresent(page.locator("table").first());
  });
  await tut.step("tocak-kuponi-filteri", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.locator('select[name="prize"]'));
    await focusIfPresent(page.locator('select[name="state"]'));
  });

  // the wheel's coupons stay out of the regular coupon list - nothing starting with TOCAK- appears there
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Kuponi", stepIdPrefix: "admin-kuponi", mobile });
  await tut.step("tocak-glavna-lista-kupona", async () => {
    await expect(page).toHaveURL(/\/admin\/kuponi/);
    await expect(page.getByText("TOCAK-")).toHaveCount(0);
    await focusIfPresent(page.locator("main table").first());
  });
}
