import { expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import { typeSlowly } from "./tutorial.fixture.js";

const PASSWORD = "lozinka123";

/**
 * Tutorial-only re-implementation of test/e2e/helpers/e2e-helpers.js's
 * registerAndLoginViaUI's REGISTER half only, typing each field instead of
 * instantly filling it. Split from login (see loginViaUISlowly below) so a
 * scenario can wrap each in its own tut.step() - originally these lived in one
 * combined function called from a single tut.step, which meant the moment of
 * landing on /prijava after submitting registration had no pause/screenshot of
 * its own and just blurred past mid-step; two steps gives that transition an
 * actual beat in the video, matching every other page-to-page transition.
 *
 * Deliberately a SEPARATE function from e2e-helpers.js's, not a shared one used
 * by both real specs and tutorials: the real e2e suite needs to run fast in CI,
 * and adding per-keystroke delay there for a video no one watches during a CI
 * run would be pure downside. Keep in sync with e2e-helpers.js's version if the
 * real registration flow's field names or post-submit behavior ever changes.
 */
export async function registerViaUISlowly(page, { email, firstName = "Test", lastName = "Korisnik", phone = null }) {
  await page.goto("/registracija");

  // no cookie-consent-banner dismissal needed here anymore - the consent cookie
  // is set BEFORE any page loads (see tutorial.fixture.js's preAcceptCookieConsent,
  // called once per context) so the banner never becomes visible in the first place

  // scoped to <main> throughout - footer.ejs's newsletter-signup widget (present
  // on every page, including /registracija and /prijava) has its OWN
  // input[name="email"], outside <main>. A bare page.locator('input[name="email"]')
  // matches both and throws a strict-mode violation the moment typeSlowly's
  // locator.click() runs; the real e2e-helpers.js version never hit this because
  // page.fill() (old-style, non-locator API) silently takes the first DOM match
  // instead of enforcing strict mode - not something to imitate, just why that
  // helper never surfaced this and this one did.
  const main = page.locator("main");
  await typeSlowly(main.locator('input[name="firstName"]'), firstName);
  await typeSlowly(main.locator('input[name="lastName"]'), lastName);
  await typeSlowly(main.locator('input[name="email"]'), email);
  // optional (form has no `required` on this field - see auth/_auth-form.ejs) -
  // most scenarios skip it since it's not central to what they're demonstrating;
  // pass it explicitly when the tutorial's whole point is showing it get collected
  if (phone) await typeSlowly(main.locator('input[name="phone"]'), phone);
  await typeSlowly(main.locator('input[name="password"]'), PASSWORD);
  await typeSlowly(main.locator('input[name="passwordConfirm"]'), PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState("networkidle");
  // registration leaves a new account "pending" awaiting email confirmation -
  // tutorials have no mailbox to click a real link from, same short-circuit as
  // the real e2e helper's version.
  await User.updateOne({ email }, { status: "active", confirmed: true });
}

/**
 * The LOGIN half - see registerViaUISlowly above for why this is split out.
 * Also used standalone for an account that was seeded directly (seedAdminUser,
 * seedEmployee) rather than through /registracija - the login-only counterpart
 * to registerViaUISlowly, same relationship as e2e-helpers.js's own
 * loginViaUI/registerAndLoginViaUI split.
 */
export async function loginViaUISlowly(page, { email, password = PASSWORD }) {
  await page.goto("/prijava");
  const main = page.locator("main");
  await typeSlowly(main.locator('input[name="email"]'), email);
  await typeSlowly(main.locator('input[name="password"]'), password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * Directly creates an already-active admin User in the DB, bypassing
 * registration AND e2e-helpers.js's promoteToAdmin (which itself drives a
 * logout -> log back in round trip through the UI just to pick up the new role
 * on the session - see that function's own comment). For a real e2e spec that
 * round trip is fine, it's testing real behavior; for a tutorial it's pure dead
 * air - a stretch of video with no narratable point of its own, sitting between
 * two steps that ARE worth showing. Skipping straight to "here's an admin
 * account, now log into it" (loginViaUISlowly) tells the same story shorter and
 * without an untracked gap in the manifest.
 */
export async function seedAdminUser({ email, firstName = "Admin", lastName = "Nalog" }) {
  const adminRole = await Role.findOne({ name: "admin" });
  if (!adminRole) throw new Error("'admin' role not found - was seedRoles() run by start-server.js?");
  return User.create({
    firstName,
    lastName,
    email,
    password: await bcrypt.hash(PASSWORD, 12),
    role: adminRole._id,
    status: "active",
    confirmed: true,
  });
}

/**
 * Tutorial-only slow-typing variant of e2e-helpers.js's
 * fillCheckoutContactAndAddress. Values match the real helper's - only the typing
 * behavior differs.
 */
export async function fillCheckoutContactAndAddressSlowly(page) {
  await typeSlowly(page.locator("#checkout-phone"), "0601234567");
  await typeSlowly(page.locator("#addr-street"), "Bulevar Oslobođenja");
  await typeSlowly(page.locator("#addr-number"), "10");
  await typeSlowly(page.locator("#addr-city"), "Novi Sad");
  await typeSlowly(page.locator("#addr-postalCode"), "21000");
}

/**
 * Tutorial-only variant of e2e-helpers.js's setEmployeeWorkingHoursViaUI - same
 * widget-driving logic (see that function's own comment on why the hidden input
 * can't be set directly).
 *
 * The from/to inputs are native `<input type="time">` (see admin-schedule.js's
 * buildSlotRow), NOT plain text fields - typeSlowly's character-by-character
 * pressSequentially("09:00") sends a literal ":" keystroke, which a native time
 * input doesn't accept as part of its HH:MM value (Chromium's time input expects
 * digit-only sequential keystrokes, e.g. "0900", to fill its hour/minute
 * segments); the ":" left the value malformed/empty, which is why working hours
 * silently failed to save (no validation error either - see this scenario's own
 * failure log). Left as plain `.fill()` here rather than switched to typeSlowly -
 * both because it needs valid digit-only input, and because a native time
 * picker's value doesn't visually "type across the screen" like a text field even
 * when it IS typed character by character, so there'd be nothing extra to see in
 * the video either way.
 */
export async function setEmployeeWorkingHoursViaUISlowly(page, day, slots) {
  const dayEl = page.locator(`[data-schedule-day="${day}"]`);
  while ((await dayEl.locator("[data-schedule-slot]").count()) > 0) {
    await dayEl.locator("[data-schedule-remove-slot]").first().click();
  }
  for (const slot of slots) {
    await dayEl.locator("[data-schedule-add-slot]").click();
    const newRow = dayEl.locator("[data-schedule-slot]").last();
    await newRow.locator("[data-schedule-from]").fill(slot.from);
    await newRow.locator("[data-schedule-to]").fill(slot.to);
  }
}

/**
 * Tutorial-only slow-typing variant of a GUEST checkout - unlike the logged-in
 * checkout (fillCheckoutContactAndAddressSlowly above), NOTHING is pre-filled
 * for a guest: firstName/lastName/email need typing too, not just phone+address.
 */
export async function fillGuestCheckoutSlowly(page, { firstName, lastName, email, phone, street, number, city, postalCode }) {
  await typeSlowly(page.locator("#checkout-firstName"), firstName);
  await typeSlowly(page.locator("#checkout-lastName"), lastName);
  await typeSlowly(page.locator("#checkout-email"), email);
  await typeSlowly(page.locator("#checkout-phone"), phone);
  await typeSlowly(page.locator("#addr-street"), street);
  await typeSlowly(page.locator("#addr-number"), number);
  await typeSlowly(page.locator("#addr-city"), city);
  await typeSlowly(page.locator("#addr-postalCode"), postalCode);
}

export { expect };

const NAV_ACTION_TIMEOUT = 10_000; // short and explicit on purpose - see comment below

/**
 * The real navigation gap this fixes: `navigateAdminViaMenu` targets the DARK
 * admin nav bar (`.navbar-dark .dropdown-toggle`, see that function's own
 * comment) - but that nav bar only renders when `currentPath.startsWith('/admin')`
 * (locals.config.js sets `currentPath`, navigation.ejs checks it). Right after
 * login, `auth.controller.js`'s `login()` redirects to `redirectTo || "/"` - the
 * public homepage, NOT `/admin` - so the dark nav simply isn't in the DOM yet.
 * Every admin-nav scenario hit this: `.navbar-dark .dropdown-toggle` timed out
 * after exactly NAV_ACTION_TIMEOUT because it doesn't exist on `/`, not because
 * of a text/selector mismatch.
 *
 * This is the real click path from `/`: the account dropdown button (top-right,
 * shows the logged-in user's first name) -> "Admin panel" item inside it. Two
 * steps, matching every other menu-click helper's pattern - and arguably the
 * more honest tutorial moment anyway, since a real admin genuinely does start
 * here, not by teleporting into `/admin`.
 *
 * Locates by the exact wrapping structure from navigation.ejs
 * (`.dropdown.d-none.d-lg-block`), not by button text - the button's text IS the
 * logged-in user's first name (varies per seeded account), and "Admin panel"
 * text also appears a SECOND time in the mobile nav's duplicate copy of this
 * same menu (hidden on desktop, but still in the DOM) - scoping to the specific
 * desktop-only wrapper avoids matching either the wrong button or the wrong
 * (hidden) duplicate link.
 */
export async function enterAdminPanel(adminPage, tut, video, { stepIdPrefix }) {
  const accountToggle = adminPage.locator(".dropdown.d-none.d-lg-block > button.dropdown-toggle");
  const adminPanelLink = adminPage.locator(".dropdown.d-none.d-lg-block a.dropdown-item[href=\"/admin\"]");

  await tut.step(`${stepIdPrefix}-otvara-nalog-meni`, async () => {
    await accountToggle.click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(adminPanelLink).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
  }, { page: adminPage, video });

  await tut.step(`${stepIdPrefix}-otvara-admin-panel`, async () => {
    await adminPanelLink.click({ timeout: NAV_ACTION_TIMEOUT });
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video });
}

/**
 * Clicks through the real admin nav dropdown - group toggle, then the specific
 * item inside it - instead of jumping straight to a URL with `page.goto()`.
 *
 * Locates by STRUCTURE (`.navbar-dark .dropdown-toggle` / `.dropdown-item`
 * scoped inside the dark admin nav specifically - see navigation.ejs), not by
 * ARIA role. An earlier version used `getByRole("button", { name })` reasoning
 * that the toggle's explicit `role="button"` attribute (on an `<a href="#">`)
 * would override its implicit link role in the accessibility tree - that's
 * correct per spec, but role computation for an anchor with both `href` and an
 * explicit `role` override is one of the genuinely inconsistent corners across
 * browser engines/AT combinations, and is exactly the kind of thing not worth
 * debugging blind without a live browser. Matching by class + visible text
 * instead sidesteps that ambiguity entirely - deterministic, tied to the actual
 * DOM Milan's markup renders, not to how a browser happens to compute a role.
 *
 * `NAV_ACTION_TIMEOUT` (10s, not the huge suite-wide test timeout) is passed
 * explicitly to every action here - if a label ever stops matching (a menu
 * label changes in navigation.ejs, a scenario passes a typo), this fails loud
 * and FAST with a normal Playwright timeout error naming the exact locator, in
 * ~10s. Without it, a mismatched selector's click()/expect() silently retries
 * against whatever the surrounding test's timeout is - which is exactly what
 * turned "a label doesn't match" into a multi-minute hang before this fix.
 */
export async function navigateAdminViaMenu(adminPage, tut, video, { groupLabel, itemLabel, stepIdPrefix }) {
  const groupToggle = adminPage.locator(".navbar-dark .dropdown-toggle", { hasText: groupLabel }).first();
  const itemLink = adminPage.locator(".navbar-dark .dropdown-item", { hasText: itemLabel }).first();

  await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
    await groupToggle.click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(itemLink).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
  }, { page: adminPage, video });

  await tut.step(`${stepIdPrefix}-bira-stavku`, async () => {
    await itemLink.click({ timeout: NAV_ACTION_TIMEOUT });
  }, { page: adminPage, video });
}

/**
 * On an admin list page (admin/_list.ejs - shared by every admin section), types
 * into the search box and opens the one matching row's "Detalji" link - instead
 * of jumping straight to `/admin/.../detalji/:id`. `searchValue` needs to
 * actually match that entity's real searchable fields (see the relevant
 * src/repositories/filters/*.filter.js - usually contactSnapshot firstName/
 * lastName/email) or no row - and no "Detalji" link - will ever appear; NOT
 * every admin list has a search box at all (payout-request has none) so don't
 * call this for those.
 *
 * Same NAV_ACTION_TIMEOUT reasoning as navigateAdminViaMenu above - a search
 * that matches zero rows fails in ~10s with a clear "locator not found" error
 * instead of hanging.
 */
export async function searchAndOpenAdminRecord(adminPage, tut, video, { searchValue, stepIdPrefix }) {
  await tut.step(`${stepIdPrefix}-pretraga`, async () => {
    await typeSlowly(adminPage.locator('input[name="search"]'), searchValue);
    // exact markup from includes/components/search.ejs - <form class="... admin-list-search">
    // wrapping a <button type="submit"> (icon-only, aria-label="Pretraži")
    await adminPage.locator("form.admin-list-search button[type=\"submit\"]").click({ timeout: NAV_ACTION_TIMEOUT });
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video });

  await tut.step(`${stepIdPrefix}-otvaranje-rezultata`, async () => {
    // exact markup from admin/_list.ejs's "view" action - <a title="Detalji" aria-label="Detalji">
    await adminPage.locator('a[title="Detalji"]').first().click({ timeout: NAV_ACTION_TIMEOUT });
  }, { page: adminPage, video });
}

/**
 * On an admin list page, clicks the top-right "create new" button - instead of
 * jumping straight to a `/dodavanje`-style URL. `createLabel` must match that
 * list's actual button text exactly (admin/_list.ejs's `data.topbar.createLabel`,
 * set per-entity in the matching admin presenter file - e.g.
 * package-purchase.presenter.js's "Dodeli paket", NOT a generic "Dodaj").
 */
export async function clickAdminCreateButton(adminPage, tut, video, { createLabel, stepIdPrefix }) {
  await tut.step(`${stepIdPrefix}-klik-na-dodaj`, async () => {
    await adminPage.locator("a.btn-primary", { hasText: createLabel }).click({ timeout: NAV_ACTION_TIMEOUT });
  }, { page: adminPage, video });
}
