import path from "path";
import { fileURLToPath } from "url";
import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Product from "../../../src/models/product.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../../fixtures/placeholder.jpg");

/**
 * Tutorial scenario, not a regression test - the most involved admin flow in
 * this whole tutorial set, and deliberately shown as such: product creation is
 * a real 3-phase wizard (product.presenter.js's prepareProductCreateStep1Data /
 * prepareProductDetailsMediaStepData / prepareProductSeoPublishStepData), each
 * phase its own full page load and POST - not a single long form. Combines
 * everything the other admin-creation tutorials introduced separately: a
 * repeater (kreiranje-paketa), a required image upload (kreiranje-paketa,
 * kreiranje-blog-posta), and the block-based content editor
 * (kreiranje-blog-posta) - all on ONE entity, across 3 separate page loads.
 * Only the fields that actually matter for a working, published product are
 * filled - many optional fields (gallery, video, related products, FAQ,
 * long description) are left alone, same "don't exhaustively fill every field"
 * choice every other admin-creation tutorial in this set makes.
 */
test.describe("Tutorial: kreiranje proizvoda", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin kreira i objavljuje novi proizvod kroz sve tri faze", async ({ page, tut }) => {
    test.slow();

    const adminEmail = `tutorial-product-create-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const suffix = Date.now();
    const productName = `Serum za lice sa vitaminom C ${suffix}`;
    const productSku = `SRM-VITC-${suffix}`;

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Prodavnica", itemLabel: "Proizvodi", stepIdPrefix: "admin-proizvodi" });
    await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi proizvod", stepIdPrefix: "admin-proizvodi" });

    // --- faza 1: osnovni podaci ---
    await tut.step("faza1-naziv-i-sku", async () => {
      await typeSlowly(page.locator('input[name="name"]'), productName);
      await typeSlowly(page.locator('input[name="sku"]'), productSku);
    });

    await tut.step("faza1-nastavak", async () => {
      await page.locator("[data-submit-btn]").click();
      // faza 2 stiže na sopstvenu URL adresu, sa "current: 2, total: 3" u
      // indikatoru napretka
      await expect(page.getByText("Faza 2 od 3")).toBeVisible();
    });

    // --- faza 2: varijante, medija ---
    await tut.step("faza2-kratak-opis", async () => {
      await typeSlowly(page.locator('textarea[name="shortDescription"]'), "Lagana formula sa vitaminom C za ujednačen ten i prirodan sjaj.");
    });

    await tut.step("faza2-dodavanje-varijante", async () => {
      // isti "repeater" widget kao kod paketa - klik dodaje nov red u DOM,
      // sadrzaj se sinhronizuje u skriveno JSON polje
      const variationsRepeater = page.locator('[data-repeater="variations"]');
      await variationsRepeater.locator("[data-repeater-add]").click();
      const newRow = variationsRepeater.locator("[data-repeater-row]").last();
      await typeSlowly(newRow.locator('[data-repeater-field="label"]'), "30ml");
      await typeSlowly(newRow.locator('[data-repeater-field="price"]'), "2900");
      await typeSlowly(newRow.locator('[data-repeater-field="stock"]'), "25");
    });

    await tut.step("faza2-otpremanje-slike", async () => {
      await page.locator('input[name="productImage"]').setInputFiles(PLACEHOLDER_IMAGE);
      await typeSlowly(page.locator('input[name="imageDesc"]'), "Serum za lice sa vitaminom C - bočica 30ml");
    });

    await tut.step("faza2-nastavak", async () => {
      await page.locator("[data-submit-btn]").click();
      await expect(page.getByText("Faza 3 od 3")).toBeVisible();
    });

    // --- faza 3: dostava, objava ---
    await tut.step("faza3-nacin-dostave", async () => {
      // eksplicitno biramo "standard" (isto što i podrazumevano) samo da bi se
      // ovo polje uopšte prikazalo u tutorijalu - stvarno bitno postaje tek za
      // velike/teške artikle (videti scenario "dostava-velikog-artikla")
      await page.locator('select[name="shippingClass"]').selectOption("standard");
    });

    await tut.step("faza3-objavljivanje", async () => {
      // "Objavi proizvod odmah" je već čekirano po podrazumevanoj vrednosti -
      // ne dira se, samo se čuva
      await page.locator("[data-submit-btn]").click();
      await expectFlashSuccess(page);
    });

    const product = await Product.findOne({ sku: productSku });
    expect(product).toBeTruthy();
    expect(product.name).toBe(productName);
    expect(product.isActive).toBe(true);
    expect(product.variations).toHaveLength(1);
    expect(product.variations[0].label).toBe("30ml");
    expect(product.variations[0].price).toBe(2900);
    expect(product.variations[0].stock).toBe(25);
    expect(product.image?.img).toBeTruthy();
  });
});
