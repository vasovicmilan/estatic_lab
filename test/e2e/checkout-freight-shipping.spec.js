import { test, expect } from "@playwright/test";
import { connectDb, disconnectDb } from "./helpers/db.js";
import {
  registerAndLoginViaUI,
  promoteToAdmin,
  seedProduct,
  getOrderConfirmationUrl,
  findTemporaryOrderByEmail,
  expectFlashSuccess,
  confirmActionModal,
  fillCheckoutContactAndAddress,
} from "./helpers/e2e-helpers.js";

/**
 * End-to-end coverage for the freight shippingClass mechanism (see
 * product.model.js / temporary-order.service.js / order.service.js) - the exact
 * business problem this was built for: a cart containing a large/heavy device that
 * can't get an automatic shipping price. Nothing below this level (unit,
 * integration) exercises the full chain a real visitor and a real admin actually
 * go through: browse -> add to cart -> checkout -> "we'll email you a shipping
 * quote" -> admin fills in the real price -> customer's own confirmation link
 * unblocks and finalizes the order.
 */
test.describe("Checkout - freight (large/heavy) product shipping quote flow", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("blocks automatic shipping, lets an admin set the real price, and only then lets the customer confirm", async ({ page, browser }) => {
    // this flow genuinely does more than a typical spec - full customer checkout,
    // a premature-confirm attempt, then a second browser page for the admin's own
    // register/login/find-order/set-price sequence. test.slow() triples the default
    // timeout (Playwright's built-in mechanism for a legitimately heavier test)
    // rather than either inflating the global config timeout for every other spec
    // or risking a flaky failure on a slower/cold-started machine.
    test.slow();

    const customerEmail = `e2e-freight-${Date.now()}@example.com`;
    const adminEmail = `e2e-admin-${Date.now()}@example.com`;

    // an expensive device - exactly the scenario that motivated shippingClass in
    // the first place (see product.model.js's comment)
    const product = await seedProduct({ shippingClass: "freight", price: 250000, stock: 3 });

    // --- customer: browse, add to cart, checkout ---
    await registerAndLoginViaUI(page, { email: customerEmail });

    await page.goto(`/prodavnica/${product.slug}`);
    await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    await expectFlashSuccess(page);

    await page.goto("/korpa");
    await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
    await expect(page).toHaveURL(/\/korpa\/naplata/);

    // phone isn't collected at registration, and address fields aren't prefilled for
    // a brand-new account with no saved address - both are required on the checkout form
    await fillCheckoutContactAndAddress(page);
    await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();

    // no automatic shipping price could be computed - the real flow is "we'll email
    // you", not an immediate order confirmation
    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);
    await expect(page.getByRole("heading", { name: "Potvrdite porudžbinu" })).toBeVisible();

    let tempOrder = await findTemporaryOrderByEmail(customerEmail);
    expect(tempOrder.requiresShippingQuote).toBe(true);
    expect(tempOrder.shipping).toBe(0);

    // the customer's own confirmation link must refuse to finalize the order while
    // the price is still unresolved - see order.service.js's confirmOrder
    const prematureConfirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(prematureConfirmUrl);
    await expect(page.locator(".alert-danger")).toContainText(/procen/i);

    // --- admin: find the order, set the real shipping cost ---
    // a brand-new BrowserContext, not just context.newPage() - a new page/tab
    // within the SAME context still shares that context's cookie jar, which means
    // it would inherit the customer's session cookie. Since registerForm/loginForm
    // both redirect an already-logged-in session straight to "/" (see
    // auth.controller.js), that would make /registracija never actually render its
    // form at all - the exact bug this separate context avoids.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await registerAndLoginViaUI(adminPage, { email: adminEmail, firstName: "Admin", lastName: "Nalog" });
    await promoteToAdmin(adminPage, adminEmail);

    await adminPage.goto(`/admin/privremene-porudzbine/detalji/${tempOrder._id.toString()}`);
    await expect(adminPage.getByText("Čeka procenu (veliki/teški artikal)")).toBeVisible();

    await adminPage.fill('input[name="shippingAmount"]', "8000");
    await adminPage.getByRole("button", { name: "Sačuvaj cenu dostave" }).click();
    await confirmActionModal(adminPage);
    await expectFlashSuccess(adminPage);

    tempOrder = await findTemporaryOrderByEmail(customerEmail);
    expect(tempOrder.requiresShippingQuote).toBe(false);
    expect(tempOrder.shipping).toBe(8000);

    // --- customer: same confirmation link now works ---
    const finalConfirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(finalConfirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();

    await adminContext.close();
  });

  test("a cart with only standard-shipping items gets the normal flat price immediately, no quote step", async ({ page }) => {
    const customerEmail = `e2e-standard-${Date.now()}@example.com`;
    const product = await seedProduct({ shippingClass: "standard", price: 1500, stock: 10 });

    await registerAndLoginViaUI(page, { email: customerEmail });

    await page.goto(`/prodavnica/${product.slug}`);
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();

    await page.goto("/korpa");
    await page.getByRole("link", { name: "Nastavi na naplatu" }).click();
    await fillCheckoutContactAndAddress(page);
    await page.getByRole("button", { name: "Potvrdi porudžbinu" }).click();

    await expect(page).toHaveURL(/\/korpa\/potvrdite-porudzbinu/);

    const tempOrder = await findTemporaryOrderByEmail(customerEmail);
    expect(tempOrder.requiresShippingQuote).toBe(false);
    expect(tempOrder.shipping).toBeGreaterThan(0);

    // no admin step needed - the customer's own link should confirm immediately
    const confirmUrl = await getOrderConfirmationUrl(customerEmail);
    await page.goto(confirmUrl);
    await expect(page.getByRole("heading", { name: "Porudžbina je potvrđena" })).toBeVisible();
  });
});