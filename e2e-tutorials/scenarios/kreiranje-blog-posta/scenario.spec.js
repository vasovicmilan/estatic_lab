import path from "path";
import { fileURLToPath } from "url";
import { test, expect, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu, clickAdminCreateButton } from "../../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import Post from "../../../src/models/post.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_IMAGE = path.resolve(__dirname, "../../fixtures/placeholder.jpg");

/**
 * Tutorial scenario, not a regression test - the CONTENT side of the admin
 * panel, single-phase (unlike kreiranje-proizvoda's 3-phase wizard, even though
 * both share the exact same block-based body editor). One paragraph block is
 * added here to demonstrate the editor's real interaction pattern (pick a block
 * type, click "Dodaj blok", a new block appears with its own fields,
 * admin-content-blocks.js) without walking through all fourteen block types -
 * see that file's own BLOCK_FIELDS map if a future scenario needs a different one.
 */
test.describe("Tutorial: kreiranje blog posta", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin piše i odmah objavljuje novi blog post", async ({ page, tut }) => {
    test.slow();

    const adminEmail = `tutorial-post-create-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const postTitle = `5 saveta za negu kože - ${Date.now()}`;

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(page, { email: adminEmail });
    });

    await enterAdminPanel(page, tut, undefined, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(page, tut, undefined, { groupLabel: "Sadržaj i marketing", itemLabel: "Blog", stepIdPrefix: "admin-blog" });
    await clickAdminCreateButton(page, tut, undefined, { createLabel: "Novi post", stepIdPrefix: "admin-blog" });

    await tut.step("unos-naslova-i-opisa", async () => {
      await typeSlowly(page.locator('input[name="title"]'), postTitle);
      await typeSlowly(page.locator('textarea[name="excerpt"]'), "Jednostavni svakodnevni koraci koji stvarno prave razliku.");
    });

    await tut.step("dodavanje-pasusa", async () => {
      // blok editor: izaberi tip, klikni "Dodaj blok", novi blok se pojavi sa
      // sopstvenim poljima - "pasus" je prvi/podrazumevani tip
      const blocksWidget = page.locator('[data-content-blocks="content"]');
      await blocksWidget.locator("[data-block-type-select]").selectOption("paragraph");
      await blocksWidget.locator("[data-block-add]").click();
      const newBlock = blocksWidget.locator("[data-content-block]").last();
      await typeSlowly(newBlock.locator('[data-block-field="text"]'), "Nega kože ne mora da bude komplikovana - par doslednih navika daje bolje rezultate od skupih tretmana bez rutine.");
    });

    await tut.step("izbor-statusa", async () => {
      await page.locator('select[name="status"]').selectOption("published");
    });

    await tut.step("otpremanje-naslovne-slike", async () => {
      await page.locator('input[name="coverImage"]').setInputFiles(PLACEHOLDER_IMAGE);
      await typeSlowly(page.locator('input[name="coverImageDesc"]'), "Nega kože - naslovna fotografija");
    });

    await tut.step("cuvanje-posta", async () => {
      await page.locator("[data-submit-btn]").click();
      await expectFlashSuccess(page);
    });

    const post = await Post.findOne({ title: postTitle });
    expect(post).toBeTruthy();
    expect(post.status).toBe("published");
    expect(post.content).toHaveLength(1);
    expect(post.content[0].type).toBe("paragraph");
    expect(post.coverImage?.img).toBeTruthy();
  });
});
