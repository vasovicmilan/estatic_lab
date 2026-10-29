import { expect } from "../scripts/tutorial.fixture.js";
import {
  registerViaNavSlowly, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab, backToSiteFromPortal, scrollToTop,
} from "../scripts/slow-actions.js";

/**
 * Shared flow of "moj-nalog-pregled" / "moj-nalog-pregled-mobilni" - the customer's own
 * account (/nalog) from first registration to logging out: account menu -> "Moj profil",
 * every tab of the account (top pills on a computer, the bottom bar on a phone), the way
 * back to the site, and "Odjava". Nothing is reached by typing a URL.
 */
export async function run({ page, tut, mobile }) {
  const customerEmail = `tutorial-nalog-${Date.now()}@example.com`;

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await registerViaNavSlowly(page, tut, { mobile, email: customerEmail, firstName: "Milica", lastName: "Stanković", phone: "0629876543" });

  await tut.step("prijava", async () => {
    await expect(page).toHaveURL(/\/prijava/);
    await fillLoginFormSlowly(page, { email: customerEmail });
  });

  await openAccountMenuItem(page, tut, { mobile, href: "/nalog", stepIdPrefix: "nalog-profil" });

  await tut.step("pregled-profila", async () => {
    await expect(page.getByRole("heading", { name: "Moj nalog", exact: true })).toBeVisible();
  });

  const tabs = [
    { id: "tab-termini", label: "Termini", url: /\/nalog\/termini/ },
    { id: "tab-porudzbine", label: "Porudžbine", url: /\/nalog\/porudzbine/ },
    { id: "tab-adrese", label: "Adrese", url: /\/nalog\/adrese/ },
    { id: "tab-aktivnost", label: "Aktivnost", url: /\/nalog\/aktivnost/ },
    { id: "tab-podesavanja", label: "Podešavanja", url: /\/nalog\/podesavanja/ },
    { id: "tab-profil", label: "Profil", url: /\/nalog$/ },
  ];
  for (const tab of tabs) {
    await tut.step(tab.id, async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile, label: tab.label });
      await expect(page).toHaveURL(tab.url);
    });
  }

  await backToSiteFromPortal(page, tut);
  await expect(page).toHaveURL(/\/$/);

  await openAccountMenuItem(page, tut, { mobile, href: "/odjava", stepIdPrefix: "odjava" });

  await tut.step("odjavljen", async () => {
    // logged out: the header offers "Prijava" again
    await expect(page.locator('#mainNav a[href="/prijava"]').first()).toBeAttached();
  });
}
