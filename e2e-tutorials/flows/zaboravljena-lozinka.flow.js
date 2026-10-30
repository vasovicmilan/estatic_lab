import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import { goToLoginViaNav, fillLoginFormSlowly, clickVisibly } from "../scripts/slow-actions.js";
import { seedCustomer, expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import User from "../../src/models/user.model.js";

const NEW_PASSWORD = "NovaLozinka#2026";

/**
 * Shared flow of "zaboravljena-lozinka" / "-mobilni" - a customer who forgot the password:
 * "Zaboravili ste lozinku?" -> email -> link -> new password -> logging in with it. The link
 * normally arrives by email; the recording has no mailbox, so the token is read from the
 * database and the link opened directly (narrated as "the link from the email").
 */
export async function run({ page, tut, mobile }) {
  const email = `tutorial-lozinka-${Date.now()}@example.com`;
  await seedCustomer({ email });

  await tut.step("otvaranje-pocetne", async () => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
  await goToLoginViaNav(page, tut, { mobile, stepIdPrefix: "login" });

  await tut.step("zaboravljena-link", async () => {
    await clickVisibly(page.locator('main a[href="/zaboravljena-lozinka"]'), { mobile });
    await expect(page).toHaveURL(/\/zaboravljena-lozinka/);
  });

  await tut.step("zaboravljena-email", async () => {
    await typeSlowly(page.locator("main").locator('input[name="email"]'), email);
  });

  await tut.step("zaboravljena-slanje", async () => {
    await clickVisibly(page.locator("main").getByRole("button", { name: "Pošalji link" }), { mobile });
    await expectFlashSuccess(page);
  });

  const user = await User.findOne({ email });
  expect(user.resetToken).toBeTruthy();

  await tut.step("link-iz-mejla", async () => {
    await page.goto(`/resetovanje-lozinke/${user.resetToken}`);
    await expect(page.locator("main").locator('input[name="newPassword"]')).toBeVisible();
  });

  await tut.step("nova-lozinka", async () => {
    const main = page.locator("main");
    await typeSlowly(main.locator('input[name="newPassword"]'), NEW_PASSWORD);
    await typeSlowly(main.locator('input[name="confirmPassword"]'), NEW_PASSWORD);
  });

  await tut.step("nova-lozinka-cuvanje", async () => {
    await clickVisibly(page.locator("main").getByRole("button", { name: "Sačuvaj lozinku" }), { mobile });
    await expectFlashSuccess(page);
    await expect(page).toHaveURL(/\/prijava/);
  });

  await tut.step("prijava-novom-lozinkom", async () => {
    await fillLoginFormSlowly(page, { email, password: NEW_PASSWORD });
    await expect(page).not.toHaveURL(/\/prijava/);
  });
}
