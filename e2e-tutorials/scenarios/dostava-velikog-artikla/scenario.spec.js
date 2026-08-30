import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { registerViaUISlowly, loginViaUISlowly, fillCheckoutContactAndAddressSlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, searchAndOpenAdminRecord } from "../../scripts/slow-actions.js";
import { seedProduct, getOrderConfirmationUrl, findTemporaryOrderByEmail, expectFlashSuccess, confirmActionModal } from "../../../test/e2e/helpers/e2e-helpers.js";

/**
 * Tutorial scenario, not a regression test - adapted from
 * checkout-freight-shipping.spec.js's main case: a large/heavy product
 * (shippingClass: "freight") can't get an automatic shipping price, so checkout
 * doesn't finalize the order - it only sends an informational "we'll calculate
 * shipping and email you once it's ready" notice. The REAL, actionable confirm
 * link only gets emailed once an admin sets the real price - not at checkout
 * time (see temporary-order.service.js's createTemporaryOrder/
 * updateTemporaryOrderShipping for why: a link that could expire before an admin
 * even finishes pricing it was the actual bug this flow used to have). Worth its
 * own tutorial specifically because it's a real business rule a client is likely
 * to ask "wait, why didn't my order confirm right away?" about.
 */
test.describe("Tutorial: dostava velikog artikla", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("porudžbina velikog artikla čeka procenu cene dostave pre nego što stigne prava email potvrda", async ({ page, browser, tut }) => {
    test.slow();

    // skup, veliki uređaj - baš scenario zbog kog shippingClass postoji (videti
    // product.model.js)
    const product = await seedProduct({ shippingClass: "freight", price: 250000, stock: 3 });
    const customerEmail = `tutorial-freight-${Date.now()}@example.com`;

    await tut.step("registracija", async () => {
      await registerViaUISlowly(page, { email: customerEmail, firstName: "Nikola", lastName: "Popović" });
    });

    await tut.step("prijava", async () => {
      await loginViaUISlowly(page, { email: customerEmail });
    });

    await tut.step("otvaranje-stranice-proizvoda", async () => {
      await page.goto(`/prodavnica/${product.slug}`);
      await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    });

    await tut.step("dodavanje-u-korpu", async () => {
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
      await expectFlashSuccess(page);
    });

    await tut.step("prelazak-na-naplatu", async () => {
      await page.goto("/korpa");
      await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
      await expect(page).toHaveURL(/\/korpa\/naplata/);
    });

    await tut.step("unos-podataka-za-dostavu", async () => {
      await fillCheckoutContactAndAddressSlowly(page);
    });

    await tut.step("porudzbina-primljena", async () => {
      await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();
      // nema automatske cene dostave - klijent dobija samo informativni email
      // (bez linka), ne akcioni "potvrdite porudžbinu" kao kod standardne
      // dostave - videti createTemporaryOrder/sendOrderPendingQuoteEmail
      await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
      await expect(page.getByRole("heading", { name: "Porudžbina primljena" })).toBeVisible();
    });

    // --- admin: pronalazi porudžbinu, unosi pravu cenu dostave ---
    const adminEmail = `tutorial-freight-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "dostava-velikog-artikla", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Prodavnica", itemLabel: "Privremene porudžbine", stepIdPrefix: "admin-privremene" });
    await searchAndOpenAdminRecord(adminPage, tut, adminVideo, { searchValue: customerEmail, stepIdPrefix: "admin-privremene" });
    await expect(adminPage.getByText("Čeka procenu (veliki/teški artikal)")).toBeVisible();

    await tut.step("admin-unosi-cenu-dostave", async () => {
      // ovim se, u pozadini, kupcu šalje NOVI email - tek sada sa pravim linkom
      // za potvrdu i konačnom cenom (svež token, ne onaj sa checkout-a)
      await typeSlowly(adminPage.locator('input[name="shippingAmount"]'), "8000");
      await adminPage.getByRole("button", { name: "Sačuvaj cenu dostave" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const updatedTempOrder = await findTemporaryOrderByEmail(customerEmail);
    expect(updatedTempOrder.requiresShippingQuote).toBe(false);
    expect(updatedTempOrder.shipping).toBe(8000);

    // --- klijent: dobija pravi email tek sada, sa radnim linkom ---
    await tut.step("email-potvrde-sa-cenom", async () => {
      const confirmUrl = await getOrderConfirmationUrl(customerEmail);
      await page.goto(confirmUrl);
      await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
    });

    await finalizeAdminVideo();
  });
});
