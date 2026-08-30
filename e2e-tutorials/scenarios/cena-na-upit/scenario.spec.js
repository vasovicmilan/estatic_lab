import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Product from "../../../src/models/product.model.js";

/**
 * Tutorial scenario, not a regression test - a product's real cost is sometimes
 * too volatile to quote automatically (product.model.js's own comment on
 * priceOnRequest: import/shipping cost swinging too much) - the public page
 * shows "Cena na upit" instead of any price and a "contact us" link instead of
 * "add to cart", and the sale happens entirely OUTSIDE normal checkout: a
 * contact-form inquiry, then an admin manually creating the order with a
 * hand-typed price (order.controller.js's createManualOrder). Worth its own
 * tutorial specifically because it's a genuinely different path end to end, not
 * a variant of the usual checkout flow.
 */
test.describe("Tutorial: cena na upit", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("proizvod bez cene ide preko upita, admin ručno kreira porudžbinu sa unetom cenom", async ({ page, browser, tut }) => {
    test.slow();

    const suffix = Date.now();
    const product = await Product.create({
      name: `Industrijska mašina za pranje ${suffix}`,
      slug: `industrijska-masina-za-pranje-${suffix}`,
      sku: `UPIT-${suffix}`,
      shortDescription: "Profesionalna oprema - cena zavisi od trenutnih uslova nabavke.",
      shippingClass: "freight",
      priceOnRequest: true,
      isActive: true,
      image: { img: "/images/products/e2e-placeholder.webp", imgDesc: "E2E test placeholder slika" },
      variations: [{ label: "Standard", price: 0, stock: 1, isActive: true }],
    });

    const customerEmail = `tutorial-upit-${Date.now()}@example.com`;

    await tut.step("otvaranje-proizvoda-na-upit", async () => {
      await page.goto(`/prodavnica/${product.slug}`);
      await expect(page.getByRole("heading", { name: "Cena na upit" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Dodaj u korpu" })).toHaveCount(0);
    });

    await tut.step("prelazak-na-kontakt-formu", async () => {
      await page.getByRole("link", { name: "Kontaktirajte nas za cenu" }).click();
      await expect(page).toHaveURL(/\/kontakt/);
      // tema polja je unapred popunjena imenom proizvoda
      await expect(page.locator("#contact-topic")).toHaveValue(new RegExp(product.name));
    });

    await tut.step("popunjavanje-upita", async () => {
      await typeSlowly(page.locator("#contact-firstName"), "Vladimir");
      await typeSlowly(page.locator("#contact-lastName"), "Đorđević");
      await typeSlowly(page.locator("#contact-email"), customerEmail);
      await typeSlowly(page.locator("#contact-phone"), "0611234567");
      await typeSlowly(page.locator("#contact-message"), "Zanima me cena i rok isporuke za ovaj model.");
      await page.locator("#consentCheck").check();
    });

    await tut.step("slanje-upita", async () => {
      await page.getByRole("button", { name: "Pošalji poruku" }).click();
      await expectFlashSuccess(page);
    });

    // --- admin: vidi upit, ručno kreira porudžbinu sa unetom cenom ---
    const adminEmail = `tutorial-upit-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "cena-na-upit", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Prodavnica", itemLabel: "Porudžbine", stepIdPrefix: "admin-porudzbine" });
    await clickAdminCreateButton(adminPage, tut, adminVideo, { createLabel: "Nova porudžbina (ručno)", stepIdPrefix: "admin-porudzbine" });

    await tut.step("admin-bira-proizvod", async () => {
      await adminPage.locator("#productId").selectOption({ value: product._id.toString() });
      await expect(adminPage.locator("#variantId")).toBeEnabled();
      await adminPage.locator("#variantId").selectOption({ index: 1 });
    }, { page: adminPage, video: adminVideo });

    await tut.step("admin-unosi-kontakt-i-cenu", async () => {
      await typeSlowly(adminPage.locator("#firstName"), "Vladimir");
      await typeSlowly(adminPage.locator("#lastName"), "Đorđević");
      await typeSlowly(adminPage.locator("#email"), customerEmail);
      await typeSlowly(adminPage.locator("#phone"), "0611234567");
      await typeSlowly(adminPage.locator("#addressCity"), "Novi Sad");
      await typeSlowly(adminPage.locator("#addressPostalCode"), "21000");
      await typeSlowly(adminPage.locator("#addressStreet"), "Industrijska zona");
      await typeSlowly(adminPage.locator("#addressNumber"), "5");

      // cena za ovaj proizvod ne postoji dok je admin ručno ne unese - baš
      // razlog zbog kog cela ova porudžbina i postoji van normalnog checkout-a
      await adminPage.locator("#overridePrice").check();
      await typeSlowly(adminPage.locator("#priceOverride"), "185000");
      await typeSlowly(adminPage.locator("#shipping"), "12000");
    }, { page: adminPage, video: adminVideo });

    await tut.step("admin-kreira-porudzbinu", async () => {
      await adminPage.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
      await expectFlashSuccess(adminPage);
      await expect(adminPage).toHaveURL(/\/admin\/porudzbine\/detalji\//);
    }, { page: adminPage, video: adminVideo });

    const { default: Order } = await import("../../../src/models/order.model.js");
    const order = await Order.findOne({ "contactSnapshot.email": customerEmail });
    expect(order).toBeTruthy();
    expect(order.items[0].price).toBe(185000);
    expect(order.totalPrice).toBe(197000); // 185000 (cena) + 12000 (dostava)

    await finalizeAdminVideo();
  });
});
