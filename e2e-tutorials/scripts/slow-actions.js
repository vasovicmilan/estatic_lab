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
  await fillRegisterFormSlowly(page, { email, firstName, lastName, phone });
}

/**
 * The registration FORM only (no page.goto) - split out of registerViaUISlowly so a
 * scenario that reached /registracija by clicking "Registracija" in the header
 * (registerViaNavSlowly below) fills the exact same form without jumping to a URL.
 */
export async function fillRegisterFormSlowly(page, { email, firstName = "Test", lastName = "Korisnik", phone = null }) {
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
export async function enterAdminPanel(adminPage, tut, video, { stepIdPrefix, mobile = false }) {
  // mobile: the same "Admin panel" entry lives in the burger menu's flat account
  // section (navigation.ejs, `d-lg-none` block) instead of the desktop dropdown
  const accountToggle = mobile
    ? adminPage.locator('.navbar-toggler[data-bs-target="#mainNav"]')
    : adminPage.locator(".dropdown.d-none.d-lg-block > button.dropdown-toggle");
  const adminPanelLink = mobile
    ? adminPage.locator('#mainNav a.nav-link[href="/admin"]')
    : adminPage.locator(".dropdown.d-none.d-lg-block a.dropdown-item[href=\"/admin\"]");

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
export async function navigateAdminViaMenu(adminPage, tut, video, { groupLabel, itemLabel, stepIdPrefix, mobile = false }) {
  const groupToggle = adminPage.locator(".navbar-dark .dropdown-toggle", { hasText: groupLabel }).first();
  const itemLink = adminPage.locator(".navbar-dark .dropdown-item", { hasText: itemLabel }).first();

  await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
    if (mobile) {
      // the dark admin nav is collapsed behind its own burger button on a phone
      await adminPage.locator('.navbar-toggler[data-bs-target="#adminNav"]').click({ timeout: NAV_ACTION_TIMEOUT });
      await expect(groupToggle).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
    }
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
export async function searchAndOpenAdminRecord(adminPage, tut, video, { searchValue, stepIdPrefix, mobile = false }) {
  await tut.step(`${stepIdPrefix}-pretraga`, async () => {
    await typeSlowly(adminPage.locator('input[name="search"]'), searchValue);
    // exact markup from includes/components/search.ejs - <form class="... admin-list-search">
    // wrapping a <button type="submit"> (icon-only, aria-label="Pretraži")
    await adminPage.locator("form.admin-list-search button[type=\"submit\"]").click({ timeout: NAV_ACTION_TIMEOUT });
    await adminPage.waitForLoadState("networkidle");
  }, { page: adminPage, video });

  await tut.step(`${stepIdPrefix}-otvaranje-rezultata`, async () => {
    // exact markup from admin/_list.ejs's "view" action - <a title="Detalji" aria-label="Detalji">
    const detailsLink = adminPage.locator('a[title="Detalji"]').first();
    // on a phone the list is a horizontally scrolling table (admin/_list.ejs wraps it
    // in .table-responsive) - the "Detalji" icon sits off to the right, out of the
    // 390px screen. Click() would scroll it into view instantly, which in a video is a
    // jump cut; scrolling there smoothly first shows the viewer where the icon is.
    if (mobile) {
      await detailsLink.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }));
      await adminPage.waitForTimeout(900);
    }
    await detailsLink.click({ timeout: NAV_ACTION_TIMEOUT });
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


// ---------------------------------------------------------------------------
// Navigation helpers (desktop + mobile) - used by the partner scenarios so the
// video shows EVERY menu click instead of jumping to a URL with page.goto().
// `mobile` switches between the desktop header (dropdown, top pills) and the
// phone layout (burger button, flat account section, bottom tab bar).
// ---------------------------------------------------------------------------

/**
 * Scrolls an element to the middle of the screen smoothly and waits a beat, so on a
 * phone (where most of a page is below the fold) the video visibly travels to the
 * thing being narrated instead of the element just being there in a screenshot.
 */
export async function scrollToSmoothly(locator) {
  await locator.first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await locator.first().page().waitForTimeout(900);
}

/** Scrolls back to the top of the page (so the next navigation click is visible). */
export async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(700);
}

/** First VISIBLE match of some text - the responsive pages render both a table and a card list, one of them hidden. */
export function visibleText(page, text) {
  return page.getByText(text).locator("visible=true").first();
}

/** Status cell on desktop (<td>) / status badge on mobile (<span class="badge">). */
export function visibleStatus(page, text) {
  return page.locator("td, .badge", { hasText: text }).locator("visible=true").first();
}

/** The login FORM only (no page.goto) - for a scenario that already navigated to /prijava by clicking. */
export async function fillLoginFormSlowly(page, { email, password = PASSWORD }) {
  const main = page.locator("main");
  await typeSlowly(main.locator('input[name="email"]'), email);
  await typeSlowly(main.locator('input[name="password"]'), password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * From the homepage: (mobile) opens the burger menu, then clicks "Prijava".
 * Steps: `${prefix}-otvara-meni` (mobile only), `${prefix}-klik-prijava`.
 */
export async function goToLoginViaNav(page, tut, { mobile = false, stepIdPrefix = "login" } = {}) {
  if (mobile) {
    await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
      await page.locator('.navbar-toggler[data-bs-target="#mainNav"]').click({ timeout: NAV_ACTION_TIMEOUT });
      await expect(page.locator('#mainNav a[href="/prijava"]')).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
    });
  }
  await tut.step(`${stepIdPrefix}-klik-prijava`, async () => {
    await page.locator('a[href="/prijava"]').locator("visible=true").first().click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/**
 * Opens the logged-in account menu and clicks one entry (e.g. "Partnerski nalog").
 * Desktop: account dropdown top-right -> item. Mobile: burger button -> flat
 * account section at the bottom of the menu (scrolled into view first).
 * Steps: `${prefix}-otvara-meni`, `${prefix}-bira-stavku`.
 */
export async function openAccountMenuItem(page, tut, { mobile = false, href, stepIdPrefix = "portal" }) {
  const toggle = mobile
    ? page.locator('.navbar-toggler[data-bs-target="#mainNav"]')
    : page.locator(".dropdown.d-none.d-lg-block > button.dropdown-toggle");
  const item = mobile
    ? page.locator(`#mainNav .d-lg-none a.nav-link[href="${href}"]`)
    : page.locator(`.dropdown.d-none.d-lg-block a.dropdown-item[href="${href}"]`);

  await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
    await toggle.click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(item).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
    if (mobile) await scrollToSmoothly(item);
  });
  await tut.step(`${stepIdPrefix}-bira-stavku`, async () => {
    await item.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/** Clicks a tab of the self-service portal: top pills on desktop, fixed bottom bar on a phone. */
export async function clickPortalTab(page, { mobile = false, label }) {
  const bar = page.locator(mobile ? ".portal-bottom-nav" : ".portal-desktop-nav");
  await bar.getByRole("link", { name: label, exact: true }).click({ timeout: NAV_ACTION_TIMEOUT });
  await page.waitForLoadState("networkidle");
}


// ---------------------------------------------------------------------------
// Public-site navigation + "visible" form interactions (desktop + mobile).
// Everything below clicks through the real header/menus - nothing jumps to a URL -
// so the video shows each click a first-time visitor would have to make.
// Step ids emitted here have shared (desktop/phone) wording in
// e2e-tutorials/common-narration.json, so a scenario does not have to re-write them.
// ---------------------------------------------------------------------------

/**
 * Briefly outlines an element in red (and scrolls it to the middle of the screen
 * first). Native <select>, <input type="date"> and file inputs change value with no
 * visible interaction in a recording - the OS popup / file dialog is never part of the
 * video - so without this the viewer sees a value appear out of nowhere and cannot tell
 * WHICH field was used.
 */
export async function highlight(locator, { ms = 1400 } = {}) {
  const el = locator.first();
  await scrollToSmoothly(el);
  await el.evaluate((node, duration) => {
    const prevOutline = node.style.outline;
    const prevOffset = node.style.outlineOffset;
    node.style.outline = "3px solid #dc2626";
    node.style.outlineOffset = "3px";
    setTimeout(() => {
      node.style.outline = prevOutline;
      node.style.outlineOffset = prevOffset;
    }, duration);
  }, ms);
  await el.page().waitForTimeout(ms);
}

/** selectOption() with the field highlighted first - see highlight(). */
export async function selectOptionVisibly(locator, option, opts = {}) {
  await highlight(locator, opts);
  await locator.selectOption(option);
}

/** Sets a native date input (YYYY-MM-DD) with the field highlighted first. */
export async function chooseDateVisibly(locator, isoDate, opts = {}) {
  await highlight(locator, opts);
  await locator.fill(isoDate);
}

/** setInputFiles() with the file input highlighted first (its dialog is never recorded). */
export async function uploadFileVisibly(locator, filePath, opts = {}) {
  await highlight(locator, opts);
  await locator.setInputFiles(filePath);
}

/** First visible match inside the open/collapsed main site menu. */
function mainNavLink(page, href) {
  return page.locator(`#mainNav .navbar-nav a.nav-link[href="${href}"]`).locator("visible=true").first();
}

/** Step shared by every phone flow: tap the burger button and wait for the menu to open. */
async function openBurgerStep(page, tut, id) {
  await tut.step(id, async () => {
    await page.locator('.navbar-toggler[data-bs-target="#mainNav"]').click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(page.locator("#mainNav")).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
  });
}

/**
 * Clicks one of the main menu links (Usluge, Paketi, Prodavnica, Blog, ...).
 * Phone: burger button first (step "nav-otvara-meni"), then the link, scrolled into view.
 * Steps: "nav-otvara-meni" (phone only), then `id` (e.g. "nav-usluge").
 */
export async function clickMainNavLink(page, tut, { mobile = false, href, id }) {
  const link = mainNavLink(page, href);
  if (mobile) await openBurgerStep(page, tut, "nav-otvara-meni");
  await tut.step(id, async () => {
    if (mobile) await scrollToSmoothly(link);
    await link.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/**
 * Clicks an entry of the secondary "Više" group (O nama, Naši saradnici, Česta pitanja).
 * Desktop: opens the "Više" dropdown (step "nav-vise-otvara"), then the entry.
 * Phone: those entries are flat links in the burger menu - same as clickMainNavLink.
 */
export async function openMoreMenuLink(page, tut, { mobile = false, href, id }) {
  if (mobile) return clickMainNavLink(page, tut, { mobile, href, id });
  const toggle = page.locator("#mainNav .dropdown.d-none.d-lg-block > a.dropdown-toggle");
  const item = page.locator(`#mainNav .dropdown.d-none.d-lg-block a.dropdown-item[href="${href}"]`);
  await tut.step("nav-vise-otvara", async () => {
    await toggle.click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(item).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
  });
  await tut.step(id, async () => {
    await item.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/** The header's primary "Zakažite termin" button (goes to /usluge). Phone: burger first. */
export async function clickBookNowButton(page, tut, { mobile = false, id = "nav-zakazite-termin" } = {}) {
  const button = page.locator('#mainNav a.btn-primary[href="/usluge"]').locator("visible=true").first();
  if (mobile) await openBurgerStep(page, tut, "nav-otvara-meni");
  await tut.step(id, async () => {
    if (mobile) await scrollToSmoothly(button);
    await button.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/**
 * From a page of the main site: (phone) opens the burger menu, then clicks "Registracija".
 * Steps: `${prefix}-otvara-meni` (phone only), `${prefix}-klik-registracija`.
 */
export async function goToRegisterViaNav(page, tut, { mobile = false, stepIdPrefix = "registracija" } = {}) {
  const link = page.locator('#mainNav a[href="/registracija"]').locator("visible=true").first();
  if (mobile) {
    await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
      await page.locator('.navbar-toggler[data-bs-target="#mainNav"]').click({ timeout: NAV_ACTION_TIMEOUT });
      await expect(link).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
    });
  }
  await tut.step(`${stepIdPrefix}-klik-registracija`, async () => {
    await link.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/**
 * Whole registration, reached by clicking: header "Registracija" -> the form filled in
 * key by key -> submitted. The new account is activated straight in the database
 * afterwards (there is no mailbox to click the confirmation link in).
 * Steps: registracija-otvara-meni (phone), registracija-klik-registracija, `stepId`.
 */
export async function registerViaNavSlowly(page, tut, { mobile = false, email, firstName = "Test", lastName = "Korisnik", phone = null, stepId = "registracija" }) {
  await goToRegisterViaNav(page, tut, { mobile });
  await tut.step(stepId, async () => {
    await fillRegisterFormSlowly(page, { email, firstName, lastName, phone });
  });
}

/**
 * Whole login, reached by clicking: (phone: burger) -> "Prijava" -> form. Lands on the
 * home page afterwards (the app redirects there), like a real user would.
 * Steps: login-otvara-meni (phone), login-klik-prijava, `stepId`.
 */
export async function loginViaNavSlowly(page, tut, { mobile = false, email, password = PASSWORD, stepId = "prijava" }) {
  await goToLoginViaNav(page, tut, { mobile });
  await tut.step(stepId, async () => {
    await fillLoginFormSlowly(page, { email, password });
  });
}

/**
 * Leaves a self-service portal (/nalog, /moj-nalog, /moj-partner-nalog) for the public
 * site: those pages have their own slim header (portal-header.ejs) instead of the main
 * menu, so the way back is its account dropdown -> "Nazad na sajt".
 * Steps: `${prefix}-otvara-meni`, `${prefix}-bira-stavku` (default prefix "portal-nazad").
 */
export async function backToSiteFromPortal(page, tut, { stepIdPrefix = "portal-nazad" } = {}) {
  const toggle = page.locator(".portal-header .dropdown-toggle");
  const back = page.locator('.portal-header a.dropdown-item[href="/"]');
  await tut.step(`${stepIdPrefix}-otvara-meni`, async () => {
    await toggle.click({ timeout: NAV_ACTION_TIMEOUT });
    await expect(back).toBeVisible({ timeout: NAV_ACTION_TIMEOUT });
  });
  await tut.step(`${stepIdPrefix}-bira-stavku`, async () => {
    await back.click({ timeout: NAV_ACTION_TIMEOUT });
    await page.waitForLoadState("networkidle");
  });
}

/**
 * Clicks the card/link of one catalog item (service, product, package, post) on a
 * listing page. Phone: scrolls to it first, so the video travels down the list.
 * If the item is not on the current page of the listing (listings are paged and sorted
 * newest-first, so a freshly seeded item is normally on page 1) the step falls back to
 * opening the URL directly and says so on the test console - a failure of the tutorial's
 * seed data, not something to hide.
 * Step: `id`.
 */
export async function openListedItem(page, tut, { mobile = false, href, id }) {
  const link = page.locator(`main a[href="${href}"]`).locator("visible=true").first();
  await tut.step(id, async () => {
    if ((await link.count()) === 0) {
      console.warn(`[tutorial] "${href}" is not visible on ${page.url()} - opening it directly instead of clicking its card`);
      await page.goto(href);
    } else {
      if (mobile) await scrollToSmoothly(link);
      await link.click({ timeout: NAV_ACTION_TIMEOUT });
    }
    await page.waitForLoadState("networkidle");
  });
}

/**
 * Clicks an element; on a phone scrolls it to the middle of the screen first (smoothly),
 * so the video travels to the button instead of the tap happening on something that was
 * never on screen. Desktop: plain click.
 */
export async function clickVisibly(locator, { mobile = false } = {}) {
  if (mobile) await scrollToSmoothly(locator);
  await locator.first().click({ timeout: NAV_ACTION_TIMEOUT });
}

/**
 * A `tut`-shaped object whose steps are screenshotted/timed on ANOTHER page (the
 * second actor, e.g. the admin) - so helpers written for the main page (goToLoginViaNav,
 * openAccountMenuItem, ...) can be reused for that actor without each of them having to
 * know about the `{ page, video }` argument of tut.step().
 */
export function tutFor(tut, page, video) {
  return { step: (id, fn) => tut.step(id, fn, { page, video }) };
}


/**
 * The whole "administrator gets into the admin panel" opening, by clicks only (home page ->
 * "Prijava" -> login form -> account menu -> "Admin panel"), for the actor shown on `adminPage`.
 * Works for a second actor in their own context (pass its `video`) or for the main page
 * (omit `video`). Steps: admin-otvaranje-pocetne, admin-login-[otvara-meni|klik-prijava],
 * admin-prijava, admin-ulazak-[otvara-nalog-meni|otvara-admin-panel] - common wording for
 * all of them lives in common-narration.json; a scenario may override "admin-prijava".
 */
export async function adminSignInViaNav(adminPage, tut, video, { mobile = false, email }) {
  const adminTut = tutFor(tut, adminPage, video);
  const opts = video ? { page: adminPage, video } : { page: adminPage };
  await tut.step("admin-otvaranje-pocetne", async () => {
    await adminPage.goto("/");
    await expect(adminPage.locator("main")).toBeVisible();
  }, opts);
  await goToLoginViaNav(adminPage, adminTut, { mobile, stepIdPrefix: "admin-login" });
  await tut.step("admin-prijava", async () => {
    await fillLoginFormSlowly(adminPage, { email });
  }, opts);
  await enterAdminPanel(adminPage, tut, video, { stepIdPrefix: "admin-ulazak", mobile });
}


/**
 * The customer's booking path up to the contact-details page, by clicks only: header
 * "Zakažite termin" -> the service card -> "Zakaži" on a variant -> date -> time slot.
 * Phone: burger menu first (inside clickBookNowButton). Steps: nav-otvara-meni (phone),
 * nav-zakazite-termin, otvaranje-stranice-usluge, izbor-varijante-usluge, izbor-datuma,
 * izbor-termina - all with shared wording in common-narration.json / the scenario's own file.
 * Ends on /zakazivanje/<slug>/podaci.
 */
export async function bookServiceViaNav(page, tut, { mobile = false, service }) {
  await clickBookNowButton(page, tut, { mobile });
  await openListedItem(page, tut, { mobile, href: `/usluge/${service.slug}`, id: "otvaranje-stranice-usluge" });
  await tut.step("izbor-varijante-usluge", async () => {
    await clickVisibly(page.locator(`main a[href*="/zakazivanje/${service.slug}/termin"]`), { mobile });
    await expect(page).toHaveURL(/\/termin/);
  });
  await tut.step("izbor-datuma", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await chooseDateVisibly(page.locator("#slots-date"), tomorrow.toISOString().slice(0, 10));
    await page.waitForLoadState("networkidle");
  });
  await tut.step("izbor-termina", async () => {
    await clickVisibly(page.locator('a[href*="/podaci?"]'), { mobile });
    await expect(page).toHaveURL(/\/podaci/);
  });
}
