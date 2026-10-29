import { expect } from "../scripts/tutorial.fixture.js";
import { clickMainNavLink, openMoreMenuLink, openListedItem, clickVisibly } from "../scripts/slow-actions.js";
import { seedService, seedEmployee, seedProduct, seedPackage } from "../../test/e2e/helpers/e2e-helpers.js";

/**
 * Shared flow of "pregled-sajta" / "pregled-sajta-mobilni" - a tour of the PUBLIC site for
 * someone who has never seen it: every item of the main menu, the "Više" group, one service
 * and one product opened from their listings, and the logo as the way back home. No login.
 * Its only job is to show, click by click, where everything is - on a computer and on a phone
 * (where the menu hides behind the burger button).
 */
export async function run({ page, tut, mobile }) {
  const service = await seedService({ price: 3500, duration: 45 });
  await seedEmployee({ service });
  await seedPackage({ service, sessions: 3, totalPrice: 9000 });
  const product = await seedProduct({ price: 2900, stock: 10 });

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  await clickMainNavLink(page, tut, { mobile, href: "/usluge", id: "nav-usluge" });
  await expect(page).toHaveURL(/\/usluge/);
  await openListedItem(page, tut, { mobile, href: `/usluge/${service.slug}`, id: "otvaranje-usluge-iz-liste" });
  await expect(page).toHaveURL(new RegExp(`/usluge/${service.slug}`));

  await clickMainNavLink(page, tut, { mobile, href: "/paketi", id: "nav-paketi" });
  await expect(page).toHaveURL(/\/paketi/);

  await clickMainNavLink(page, tut, { mobile, href: "/prodavnica", id: "nav-prodavnica" });
  await expect(page).toHaveURL(/\/prodavnica/);
  await openListedItem(page, tut, { mobile, href: `/prodavnica/${product.slug}`, id: "otvaranje-proizvoda-iz-liste" });
  await expect(page).toHaveURL(new RegExp(`/prodavnica/${product.slug}`));

  await clickMainNavLink(page, tut, { mobile, href: "/blog", id: "nav-blog" });
  await expect(page).toHaveURL(/\/blog/);

  await clickMainNavLink(page, tut, { mobile, href: "/nas-tim", id: "nav-nas-tim" });
  await expect(page).toHaveURL(/\/nas-tim/);

  await clickMainNavLink(page, tut, { mobile, href: "/partnerski-program", id: "nav-partnerski-program" });
  await expect(page).toHaveURL(/\/partnerski-program/);

  await clickMainNavLink(page, tut, { mobile, href: "/kontakt", id: "nav-kontakt" });
  await expect(page).toHaveURL(/\/kontakt/);

  // "Više": a dropdown on a computer (opened once per entry), flat links in the burger menu on a phone
  await openMoreMenuLink(page, tut, { mobile, href: "/o-nama", id: "nav-o-nama" });
  await expect(page).toHaveURL(/\/o-nama/);

  await openMoreMenuLink(page, tut, { mobile, href: "/faq", id: "nav-faq" });
  await expect(page).toHaveURL(/\/faq/);

  await openMoreMenuLink(page, tut, { mobile, href: "/saradnici", id: "nav-saradnici" });
  await expect(page).toHaveURL(/\/saradnici/);

  await tut.step("nav-logo", async () => {
    // the brand link is visible without opening the burger menu, on both devices
    await clickVisibly(page.locator("nav.navbar a.navbar-brand").locator("visible=true"), { mobile });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/$/);
  });
}
