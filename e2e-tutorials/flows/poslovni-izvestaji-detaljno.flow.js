import { expect } from "../scripts/tutorial.fixture.js";
import {
  seedAdminUser, adminSignInViaNav, navigateAdminViaMenu, clickVisibly, scrollToSmoothly, scrollToTop, focusIfPresent,
} from "../scripts/slow-actions.js";
import businessReportService from "../../src/services/business-report.service.js";

/**
 * Shared flow of "poslovni-izvestaji-detaljno" / "-mobilni" - the business reports explained block by
 * block: the five periods on the overview, the history of saved reports, and what one saved report
 * contains. In production the cron job saves the finished periods; here the two summaries are
 * generated directly so the history and the detail page have something to show.
 */
export async function run({ page, tut, mobile }) {
  const adminEmail = `tutorial-izvestaji2-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });
  await businessReportService.generateSummary("daily");
  await businessReportService.generateSummary("monthly");

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });
  await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Poslovni izveštaji", itemLabel: "Pregled", stepIdPrefix: "admin-izvestaji", mobile });

  await tut.step("izvestaji-periodi", async () => {
    await expect(page).toHaveURL(/\/admin\/poslovni-izvestaji/);
    await focusIfPresent(page.locator("main .card").first());
  });

  await tut.step("izvestaji-uzivo", async () => {
    await focusIfPresent(page.getByText("Uživo", { exact: true }));
  });

  await tut.step("izvestaji-istorija-klik", async () => {
    const link = page.locator('a[href="/admin/poslovni-izvestaji/istorija/daily"]').locator("visible=true").first();
    await scrollToSmoothly(link);
    await link.click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/istorija\/daily/);
  });

  await tut.step("izvestaji-istorija-lista", async () => {
    await focusIfPresent(page.locator("table").first());
  });

  await tut.step("izvestaji-detalji-klik", async () => {
    const detalji = page.getByRole("link", { name: "Detalji" }).locator("visible=true").first();
    await scrollToSmoothly(detalji);
    await detalji.click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/istorija\/daily\/.+/);
  });

  await tut.step("izvestaji-detalj-zaglavlje", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.locator("h1").first());
  });

  await tut.step("izvestaji-detalj-termini", async () => {
    await focusIfPresent(page.getByText("Ukupan prihod", { exact: false }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Po usluzi" }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Po terapeutu" }));
  });

  await tut.step("izvestaji-detalj-prodavnica", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Najprodavaniji proizvodi" }));
  });

  await tut.step("izvestaji-detalj-paketi", async () => {
    await focusIfPresent(page.locator(".card-header", { hasText: "Obračun prodatih paketa" }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Po paketu" }));
  });

  await tut.step("izvestaji-detalj-provizije-kuponi", async () => {
    await focusIfPresent(page.getByRole("heading", { name: "Provizije" }));
    await focusIfPresent(page.locator(".card-header", { hasText: "Po kuponu" }));
  });

  await tut.step("izvestaji-detalj-pdf", async () => {
    await scrollToTop(page);
    await focusIfPresent(page.getByRole("link", { name: /Preuzmi PDF/ }));
  });
}
