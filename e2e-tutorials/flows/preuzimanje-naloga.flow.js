import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import { fillLoginFormSlowly, clickVisibly } from "../scripts/slow-actions.js";
import { expectFlashSuccess } from "../../test/e2e/helpers/e2e-helpers.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";

const NEW_PASSWORD = "MojaLozinka#2026";

/**
 * Shared flow of "preuzimanje-naloga" / "-mobilni" - a guest who booked or ordered without an
 * account gets a lightweight account; the email carries a "claim your account" link. The
 * recording has no mailbox, so the guest account is created directly (as a guest booking does)
 * and the link opened by address (narrated as "the link from the email").
 */
export async function run({ page, tut, mobile }) {
  const email = `tutorial-preuzimanje-${Date.now()}@example.com`;
  const role = await Role.findOne({ name: "user" });
  const token = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await User.create({
    firstName: "Ana",
    lastName: "Gost",
    email,
    role: role._id,
    provider: "local",
    status: "guest",
    confirmed: false,
    resetToken: token,
    resetTokenExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await tut.step("link-iz-mejla", async () => {
    await page.goto(`/preuzmi-nalog/${token}`);
    await expect(page.locator("main").locator('input[name="newPassword"]')).toBeVisible();
  });

  await tut.step("nova-lozinka", async () => {
    const main = page.locator("main");
    await typeSlowly(main.locator('input[name="newPassword"]'), NEW_PASSWORD);
    await typeSlowly(main.locator('input[name="confirmPassword"]'), NEW_PASSWORD);
  });

  await tut.step("preuzimanje-cuvanje", async () => {
    await clickVisibly(page.locator("main").getByRole("button", { name: "Preuzmi nalog" }), { mobile });
    await expectFlashSuccess(page);
    await expect(page).toHaveURL(/\/prijava/);
  });

  const claimed = await User.findOne({ email });
  expect(claimed.status).toBe("active");
  expect(claimed.confirmed).toBe(true);

  await tut.step("prijava-novom-lozinkom", async () => {
    await fillLoginFormSlowly(page, { email, password: NEW_PASSWORD });
    await expect(page).not.toHaveURL(/\/prijava/);
  });
}
