import path from "path";
import { fileURLToPath } from "url";
import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { seedService, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Package from "../../../src/models/package.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../../fixtures/placeholder.jpg");

/**
 * Tutorial scenario, not a regression test - the admin/catalog side of package
 * management (kupovina-paketa already covers ASSIGNING an existing package to a
 * customer; this is where that package actually comes from). Two real UI pieces
 * worth showing precisely because they're the first time this tutorial set
 * touches them: the "items" REPEATER widget (admin-repeater.js - a dynamically
 * added row per service+variant, synced into a hidden JSON field, not plain
 * indexed form fields) and a required IMAGE UPLOAD (packageImage has no default,
 * unlike everywhere else in this tutorial set that only ever displayed
 * already-seeded images).
 */
test.describe("Tutorial: kreiranje paketa", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin kreira novi paket sesija za postojeću uslugu", async ({ page, tut }) => {
    test.slow();

    const service = await seedService({ price: 3500, duration: 45 });
    const variantKey = `${service._id.toString()}::${service.packages[0]._id.toString()}`;

    const adminEmail = `tutorial-package-create-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Katalog", itemLabel: "Paketi", stepIdPrefix: "admin-paketi" });
    await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi paket", stepIdPrefix: "admin-paketi" });

    await tut.step("unos-osnovnih-podataka", async () => {
      await typeSlowly(page.locator('input[name="name"]'), "Paket relaksacije - 5 seansi");
      await typeSlowly(page.locator('textarea[name="description"]'), "Pet seansi masaže po sniženoj ceni u odnosu na pojedinačnu kupovinu.");
      await typeSlowly(page.locator('textarea[name="shortDescription"]'), "5 seansi, uštedite u odnosu na pojedinačnu cenu.");
    });

    await tut.step("dodavanje-usluge-u-paket", async () => {
      // "items" repeater - klik na "Dodaj" pravi nov red u DOM-u (JS ga sam
      // ubacuje, ne postoji unapred u markup-u), ostatak forme ostaje isti
      const itemsRepeater = page.locator('[data-repeater="items"]');
      await itemsRepeater.locator("[data-repeater-add]").click();
      const newRow = itemsRepeater.locator("[data-repeater-row]").last();
      await newRow.locator('[data-repeater-field="variantKey"]').selectOption(variantKey);
      // .fill() ovde namerno, ne typeSlowly - nativno "sessions" polje se
      // popuni sa podrazumevanom vrednošću "1" čim se red doda, pa bi kucanje
      // bez brisanja dalo "15" umesto "5"
      await newRow.locator('[data-repeater-field="sessions"]').fill("5");
    });

    await tut.step("unos-cene", async () => {
      await typeSlowly(page.locator('input[name="totalPrice"]'), "15000");
    });

    await tut.step("otpremanje-slike", async () => {
      await page.locator('input[name="packageImage"]').setInputFiles(PLACEHOLDER_IMAGE);
      await typeSlowly(page.locator('input[name="imageDesc"]'), "Paket relaksacije - promo slika");
    });

    await tut.step("cuvanje-paketa", async () => {
      await page.locator("[data-submit-btn]").click();
      await expectFlashSuccess(page);
    });

    const pkg = await Package.findOne({ name: "Paket relaksacije - 5 seansi" });
    expect(pkg).toBeTruthy();
    expect(pkg.totalPrice).toBe(15000);
    expect(pkg.items).toHaveLength(1);
    expect(pkg.items[0].sessions).toBe(5);
    expect(pkg.items[0].service.toString()).toBe(service._id.toString());
    expect(pkg.image?.img).toBeTruthy();
  });
});
