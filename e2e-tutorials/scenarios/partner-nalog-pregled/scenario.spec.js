import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import {
  loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu,
  goToLoginViaNav, fillLoginFormSlowly, openAccountMenuItem, clickPortalTab,
  scrollToSmoothly, scrollToTop, visibleText, visibleStatus,
} from "../../scripts/slow-actions.js";
import { seedPartner, seedCoupon, seedService, seedProduct, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario (računar, 1920x1080) - the partner's OWN portal (/moj-partner-nalog).
 * Every step of the navigation is clicked through like a real person would (home page
 * -> login -> account menu -> portal tabs), nothing is reached by typing a URL.
 * 
 * Same story as its sibling scenario for the other device - only the layout differs.
 */
const MOBILE = false;

test.describe("Tutorial: partnerski nalog - pregled i kopiranje koda", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("partner pregleda stanje, kopira referalni link, prolazi kroz proviziju, katalog i isplate", async ({ page, tut }) => {
    test.slow();

    const { user: partnerUser, partner } = await seedPartner({ commissionRateServices: 10, commissionRateProducts: 5 });
    const coupon = await seedCoupon({
      partner,
      discountType: "percentage",
      discountValue: 10,
      productDiscount: { discountType: "percentage", discountValue: 5 },
    });
    const service = await seedService({ price: 4000 });
    const product = await seedProduct({ price: 2500 });

    await seedCommissionEntry({ earnerType: "partner", partner, sourceType: "appointment", status: "earned", amount: 1500, rate: 10 });
    await seedCommissionEntry({ earnerType: "partner", partner, sourceType: "appointment", status: "earned", amount: 700, rate: 10 });
    await seedCommissionEntry({ earnerType: "partner", partner, sourceType: "appointment", status: "pending", amount: 400, rate: 10 });

    await tut.step("otvaranje-pocetne", async () => {
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
    });

    await goToLoginViaNav(page, tut, { mobile: MOBILE, stepIdPrefix: "login" });

    await tut.step("unos-prijave", async () => {
      await fillLoginFormSlowly(page, { email: partnerUser.email });
    });

    await openAccountMenuItem(page, tut, { mobile: MOBILE, href: "/moj-partner-nalog", stepIdPrefix: "portal" });

    await tut.step("otvaranje-partnerskog-naloga", async () => {
      await expect(page.getByRole("heading", { name: "Moj partnerski nalog" })).toBeVisible();
    });

    await tut.step("pregled-stanja", async () => {
      // 1500 + 700 zarađeno, 400 još na čekanju (termin nije završen)
      await scrollToSmoothly(page.getByText("Ukupno zarađeno"));
      await expect(visibleText(page, "Raspoloživo za isplatu")).toBeVisible();
      await expect(visibleText(page, "2200")).toBeVisible();
    });

    await tut.step("referalni-link", async () => {
      const linkInput = page.locator("[data-referral-link-input]").first();
      await scrollToSmoothly(linkInput);
      await expect(linkInput).toHaveValue(new RegExp(`code=${coupon.code}`));
    });

    await tut.step("kopiranje-linka", async () => {
      const copyBtn = page.locator("[data-copy-link-btn]").first();
      await copyBtn.click();
      // headless browser nema uvek pristup clipboard-u - u tom slučaju dugme
      // pokazuje "Označeno - kopirajte sa Ctrl+C"; oba ishoda su namerna povratna
      // informacija, ne greška
      await expect(copyBtn).toHaveText(/Kopirano|Označeno/);
    });

    await tut.step("tab-provizija", async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile: MOBILE, label: "Provizija" });
      await expect(page.getByRole("heading", { name: "Moja provizija" })).toBeVisible();
    });

    await tut.step("pregled-provizije", async () => {
      await expect(visibleText(page, "1500")).toBeVisible();
      await scrollToSmoothly(visibleText(page, "1500"));
    });

    await tut.step("filter-provizije", async () => {
      await scrollToTop(page);
      // forma se sama šalje na promenu izbora (onchange) - bez dugmeta
      await page.locator('select[name="status"]').selectOption({ label: "Na čekanju" });
      await page.waitForLoadState("networkidle");
      await expect(visibleText(page, "400")).toBeVisible();
    });

    await tut.step("tab-katalog", async () => {
      await clickPortalTab(page, { mobile: MOBILE, label: "Katalog" });
      await expect(page.getByRole("heading", { name: "Katalog za deljenje" })).toBeVisible();
      await expect(visibleText(page, service.name)).toBeVisible();
    });

    await tut.step("pretraga-kataloga", async () => {
      const search = page.locator('input[name="search"]');
      await typeSlowly(search, service.name);
      await search.press("Enter");
      await page.waitForLoadState("networkidle");
      await expect(visibleText(page, service.name)).toBeVisible();
    });

    await tut.step("kopiranje-iz-kataloga", async () => {
      const row = page.locator(".list-group-item", { hasText: service.name }).first();
      const link = row.locator("[data-referral-link-input]");
      await scrollToSmoothly(row);
      await expect(link).toHaveValue(new RegExp(`/zakazivanje/${service.slug}|/usluge/${service.slug}`));
      await expect(link).toHaveValue(new RegExp(`code=${coupon.code}`));
      const copyBtn = row.locator("[data-copy-link-btn]");
      await copyBtn.click();
      await expect(copyBtn).toHaveText(/Kopirano|Označeno/);
    });

    await tut.step("proizvodi-u-katalogu", async () => {
      // artikli se pojavljuju samo jer kod ima popust na artikle
      const search = page.locator('input[name="search"]');
      await scrollToTop(page);
      await search.fill(product.name);
      await search.press("Enter");
      await page.waitForLoadState("networkidle");
      const heading = page.getByRole("heading", { name: "Proizvodi" });
      await scrollToSmoothly(heading);
      await expect(visibleText(page, product.name)).toBeVisible();
    });

    await tut.step("tab-isplate", async () => {
      await scrollToTop(page);
      await clickPortalTab(page, { mobile: MOBILE, label: "Isplate" });
      await expect(page.getByRole("heading", { name: "Moje isplate" })).toBeVisible();
      await expect(visibleText(page, "Nemate podnetih zahteva za isplatu.")).toBeVisible();
    });

    await tut.step("tab-pregled", async () => {
      await clickPortalTab(page, { mobile: MOBILE, label: "Pregled" });
      await expect(page.getByRole("heading", { name: "Moj partnerski nalog" })).toBeVisible();
    });
  });
});
