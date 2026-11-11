import { expect } from "../scripts/tutorial.fixture.js";
import { seedAdminUser, adminSignInViaNav, scrollToSmoothly, scrollToTop, focusIfPresent } from "../scripts/slow-actions.js";

/**
 * Shared flow of "pregled-admin-panela" / "-mobilni" - an explanatory tour of the admin home page
 * ("Admin panel"): what each block means and why it is the first thing to look at every morning.
 * Read-only on purpose; the only action is switching a tab.
 */
export async function run({ page, tut, mobile }) {
  const adminEmail = `tutorial-pocetna-admin-${Date.now()}@example.com`;
  await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

  await adminSignInViaNav(page, tut, undefined, { mobile, email: adminEmail });

  await tut.step("pocetna-admin-panel", async () => {
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1", { hasText: "Admin panel" })).toBeVisible();
  });

  await tut.step("pocetna-zahteva-paznju", async () => {
    await focusIfPresent(page.locator("h2", { hasText: "Zahteva pažnju" }));
    await focusIfPresent(page.locator("main a.text-decoration-none").first());
  });

  await tut.step("pocetna-danas", async () => {
    await focusIfPresent(page.locator("h2", { hasText: "Danas" }));
  });

  await tut.step("pocetna-pregled-stanja", async () => {
    await focusIfPresent(page.locator("h2", { hasText: "Pregled" }));
  });

  await tut.step("pocetna-aktivnost-tabovi", async () => {
    const tabs = page.locator(".nav-tabs .nav-link");
    if ((await tabs.count()) > 0) {
      await scrollToSmoothly(tabs.first());
      await focusIfPresent(tabs.first());
    }
  });

  await tut.step("pocetna-drugi-tab", async () => {
    const tabs = page.locator(".nav-tabs .nav-link");
    if ((await tabs.count()) > 1) {
      await tabs.nth(1).click({ timeout: 10000 });
      await page.waitForTimeout(800);
    }
  });

  await tut.step("pocetna-meni", async () => {
    await scrollToTop(page);
    await expect(page.locator(".navbar-dark").first()).toBeAttached();
  });
}
