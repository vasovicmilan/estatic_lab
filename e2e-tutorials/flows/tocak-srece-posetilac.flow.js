import { expect, typeSlowly } from "../scripts/tutorial.fixture.js";
import { clickVisibly, scrollToSmoothly, highlight, selectOptionVisibly, focusIfPresent } from "../scripts/slow-actions.js";
import Service from "../../src/models/service.model.js";

const FREE_SERVICE_SLUGS = ["relaks-masaza", "neo-sculpt-pro", "teslatone-24"];

/**
 * The wheel's "free treatment" prizes are tied to real services by slug - on a fresh tutorial
 * database those services do not exist, and a visitor who landed on such a prize would see an error
 * instead of the result card. Create them once (desktop and phone recordings share the database).
 */
export async function ensureWheelServices() {
  for (const slug of FREE_SERVICE_SLUGS) {
    if (await Service.exists({ slug })) continue;
    await Service.create({
      name: `Tutorial ${slug}`,
      slug,
      shortDescription: "Usluga za tutorijal točka sreće.",
      image: { img: "/images/site/default-og.webp", imgDesc: "Tutorial placeholder slika" },
      isActive: true,
      packages: [{ name: "Standard", slug: "standard", sessions: 1, duration: 30, totalPrice: 3000 }],
    });
  }
}

export function randomPhone() {
  return `064${String(Math.floor(1000000 + Math.random() * 8999999))}`;
}

/**
 * Shared flow of "tocak-srece-posetilac" / "-mobilni" - what a visitor at the fair sees after
 * scanning the QR code: a short form, the wheel, the prize and the coupon code.
 */
export async function run({ page, tut, mobile }) {
  await ensureWheelServices();
  const suffix = Date.now();

  await tut.step("tocak-otvaranje", async () => {
    // the QR code opens exactly this address (the ?src= tag only marks which print/fair it came from)
    await page.goto("/tocak?src=sajam-demo");
    await expect(page.locator("h1", { hasText: "Zavrtite točak sreće" })).toBeVisible();
  });

  await tut.step("tocak-tocak", async () => {
    await focusIfPresent(page.locator("#wheelRotor"));
  });

  const form = page.locator("#wheelForm");
  await tut.step("tocak-ime", async () => {
    await scrollToSmoothly(form);
    await typeSlowly(form.locator("#w-firstName"), "Jelena");
    await typeSlowly(form.locator("#w-lastName"), `Posetilac${String(suffix).slice(-4)}`);
  });
  await tut.step("tocak-kontakt", async () => {
    await typeSlowly(form.locator("#w-email"), `tutorial-tocak-${suffix}@example.com`);
    await typeSlowly(form.locator("#w-phone"), randomPhone());
  });
  await tut.step("tocak-oblast", async () => {
    await selectOptionVisibly(form.locator("#w-segment"), "usluge");
  });
  await tut.step("tocak-pristanak", async () => {
    await clickVisibly(form.locator("#w-consentContact"), { mobile });
  });
  await tut.step("tocak-newsletter", async () => {
    await clickVisibly(form.locator("#w-consentMarketing"), { mobile });
  });
  await tut.step("tocak-vrtenje", async () => {
    await clickVisibly(page.locator("#wheelSubmit"), { mobile });
    // the server has already picked the prize; the wheel then spins 3-9 turns and lands on it
    await expect(page.locator("#wheelResult")).toBeVisible({ timeout: 40000 });
  });
  await tut.step("tocak-nagrada", async () => {
    await scrollToSmoothly(page.locator("#wheelResult"));
    await highlight(page.locator("#resultPrize"));
  });
  await tut.step("tocak-kod", async () => {
    await highlight(page.locator("#resultCode"));
    await expect(page.locator("#resultCode")).toHaveText(/^TOCAK-/);
  });
  await tut.step("tocak-rok", async () => {
    await highlight(page.locator("#resultUntil"));
  });
}
