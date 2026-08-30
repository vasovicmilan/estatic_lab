import { test as base } from "@playwright/test";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TUTORIALS_ROOT = path.resolve(__dirname, "..");

// Single source of truth for video resolution - imported into
// playwright.tutorials.config.js's `use.viewport` too, so the browser window and
// the recorder's canvas are always the exact same size. A mismatch here is what
// produced the blurry video before this change: Chromium renders at the viewport
// size, Playwright's recorder then scales that rendering into `recordVideo.size`
// - if the two differ, that scaling step is where the blur comes from.
export const VIDEO_SIZE = { width: 1920, height: 1080 };

// Matches playwright.tutorials.config.js's own PORT/BASE_URL derivation exactly -
// duplicated rather than imported because that config file itself imports FROM
// this module (VIDEO_SIZE), and importing back would create a circular import.
// Only used for preAcceptCookieConsent's context.addCookies() call below, which
// needs a real URL to validate the cookie against.
const BASE_URL = `http://localhost:${process.env.E2E_TUTORIAL_PORT || 4200}`;

// Pause after each step's screenshot, letting the recorded video actually rest on
// the resulting screen for a moment before the next step's actions start - without
// this, a step whose action is a single instant click (e.g. "click Confirm") reads
// as a blink in the video no matter how much launchOptions.slowMo slows down the
// actions within a step, since slowMo only adds delay BETWEEN Playwright API calls,
// not extra dwell time on the current page state once a step is already done.
const STEP_PAUSE_MS = Number(process.env.E2E_TUTORIAL_STEP_PAUSE_MS || 2500);

// Injected into every page of a recorded context so mouse clicks are visible in
// the video - neither headless nor headed Chromium renders an OS cursor into a
// recording by default, and Playwright's click() jumps the real mouse straight to
// the target with no visible travel, which is exactly why "what was even clicked"
// was hard to tell in the admin-side video. A floating div tracks real
// mousemove/mousedown/mouseup DOM events - Playwright's click() dispatches these
// as genuine input events at the target coordinates, so this reflects the ACTUAL
// click position, not an approximated one. The CSS transition turns the jump into
// a glide, which combined with launchOptions.slowMo's pacing between actions
// reads as natural pointer movement rather than teleporting. Registered via
// context.addInitScript (not page.addInitScript) so it's automatically present on
// every new page/navigation within the context, not just the first document.
//
// Wrapped in try/catch + waits for DOMContentLoaded if `document.body` isn't up
// yet, and no longer opacity-gated behind a first mousemove - a real run showed
// NEITHER this cursor NOR the actor badge below (which has no such gating at all)
// ever actually appearing in the recorded video, meaning the earlier version
// likely never successfully attached to the DOM in the first place. This version
// starts at 0,0 and is unconditionally visible from the first frame, and reports
// any error to the page console so it surfaces in a future test run's output
// instead of failing silently again.
const CURSOR_INIT_SCRIPT = `(() => {
  function install() {
    try {
      const ID = "__tutorial_cursor__";
      if (document.getElementById(ID)) return;
      const style = document.createElement("style");
      style.textContent =
        "#" + ID + " { position: fixed; top: 0; left: 0; width: 22px; height: 22px; " +
        "margin-left: -3px; margin-top: -3px; border-radius: 50% 50% 50% 0; " +
        "background: rgba(220, 38, 38, 0.85); border: 2px solid white; " +
        "box-shadow: 0 1px 4px rgba(0,0,0,0.4); pointer-events: none; z-index: 2147483647; " +
        "transform: rotate(-45deg); transition: left 0.15s ease-out, top 0.15s ease-out; } " +
        "#" + ID + ".clicking { transform: rotate(-45deg) scale(0.75); }";
      (document.head || document.documentElement).appendChild(style);
      const cursor = document.createElement("div");
      cursor.id = ID;
      (document.body || document.documentElement).appendChild(cursor);
      document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }, { capture: true });
      document.addEventListener("mousedown", () => cursor.classList.add("clicking"), { capture: true });
      document.addEventListener("mouseup", () => cursor.classList.remove("clicking"), { capture: true });
    } catch (err) {
      console.error("[tutorial-cursor] failed to install:", err);
    }
  }
  if (document.body) install();
  else document.addEventListener("DOMContentLoaded", install);
})();`;

/**
 * Small fixed-corner badge naming who's using the browser in THIS context
 * ("Klijent" / "Administrator" / ...) - the merged video (scripts/merge-video.mjs)
 * cuts between separate recordings of different actors with no other visual
 * signal that the screen just changed hands; without this, a viewer watching the
 * merged video has no way to tell "wait, whose screen is this now" at a cut.
 * `label` is baked into the script string at injection time (one call per
 * context, not shared) since each context only ever needs its own fixed label.
 * Same DOMContentLoaded/try-catch hardening as CURSOR_INIT_SCRIPT above, and for
 * the same reason - see that constant's comment.
 */
function actorBadgeInitScript(label) {
  const escaped = label.replace(/"/g, '\\"').replace(/</g, "&lt;");
  return `(() => {
    function install() {
      try {
        const ID = "__tutorial_actor_badge__";
        if (document.getElementById(ID)) return;
        const style = document.createElement("style");
        style.textContent =
          "#" + ID + " { position: fixed; top: 12px; left: 12px; z-index: 2147483647; " +
          "font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; " +
          "color: white; background: rgba(30, 30, 30, 0.78); padding: 4px 10px; " +
          "border-radius: 4px; pointer-events: none; letter-spacing: 0.02em; }";
        (document.head || document.documentElement).appendChild(style);
        const badge = document.createElement("div");
        badge.id = ID;
        badge.textContent = "${escaped}";
        (document.body || document.documentElement).appendChild(badge);
      } catch (err) {
        console.error("[tutorial-actor-badge] failed to install:", err);
      }
    }
    if (document.body) install();
    else document.addEventListener("DOMContentLoaded", install);
  })();`;
}

/**
 * Forwards a page's console errors and uncaught exceptions to THIS process's
 * stdout, prefixed so they're easy to spot in `npm run tutorials` output - added
 * specifically because CURSOR_INIT_SCRIPT/actorBadgeInitScript silently failed to
 * appear in a real recorded video with no visible error anywhere, and there was
 * no way to tell whether they'd thrown, been blocked, or just weren't running at
 * all. Attached per-context (context.on("page", ...)) so it covers every page
 * that context ever opens, not just the first one.
 */
function forwardPageDiagnostics(context, actorLabel) {
  context.on("page", (page) => {
    page.on("pageerror", (err) => {
      console.error(`[tutorial:${actorLabel}] uncaught page error:`, err.message || err);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error(`[tutorial:${actorLabel}] console.error:`, msg.text());
      }
    });
  });
}

/**
 * Pre-accepts the cookie consent banner (includes/components/cookie-consent.ejs)
 * before any page even loads, by setting the exact cookie its own client-side JS
 * (public/js/main.js's initCookieConsent) checks for - rather than clicking the
 * accept button reactively after it appears. Clicking-after-appearing still means
 * the banner is genuinely visible (and recorded) for at least one frame, however
 * brief; setting the cookie first means initCookieConsent's own `if
 * (getCookie(...)) return;` guard fires immediately on every single page load
 * across the whole scenario, and `banner.classList.remove("d-none")` never runs
 * at all - the banner is never part of the DOM's visible state, not even
 * momentarily. `url` alone (no `path`) - Playwright's addCookies validates cookies
 * as EITHER `url`-based OR `domain`+`path`-based, not both at once; passing `path`
 * alongside `url` trips that same validation and throws "Cookie should have
 * either url or path" even though `url` was right there (this is exactly what
 * broke on the first real run - path is redundant anyway, since a URL with no
 * explicit path segment already implies "/").
 */
async function preAcceptCookieConsent(context, baseURL) {
  await context.addCookies([{ name: "cookieConsent", value: "accepted", url: baseURL }]);
}

/**
 * Extends Playwright's `test` with a `tut` fixture - the single thing every
 * scenario.spec.js in e2e-tutorials/scenarios/ needs instead of a real e2e spec's
 * bare `test.step()`. A real e2e spec's steps exist purely to group assertions in
 * a trace/report; a tutorial's steps ARE the tutorial - each one needs a
 * screenshot and a stable id that narration.json can attach human-readable text
 * to, so this wraps every step with exactly that, in one place, rather than each
 * scenario hand-rolling its own screenshot-and-record boilerplate.
 *
 * Deliberately a thin wrapper around test.step(), not a replacement for it -
 * `tut.step(id, fn)` still calls the real test.step() internally, so tutorial
 * scenarios still get normal Playwright step reporting/tracing on top of the
 * screenshot+manifest side effect.
 */
export const test = base.extend({
  // Overrides Playwright's built-in `context` fixture (not composed with it - the
  // default context has no video recording, and video can only be turned on at
  // context-creation time, not retrofitted onto an existing one) so every
  // scenario's default `page` fixture - which is built ON TOP of `context` - is
  // automatically video-recorded with zero changes needed in scenario.spec.js
  // files themselves.
  context: async ({ browser }, use, testInfo) => {
    const scenarioId = path.basename(path.dirname(testInfo.file));
    const tmpDir = path.join(TUTORIALS_ROOT, ".video-tmp", `${scenarioId}-${Date.now()}`);
    await fs.ensureDir(tmpDir);

    const context = await browser.newContext({
      recordVideo: { dir: tmpDir, size: VIDEO_SIZE },
    });
    await context.addInitScript({ content: CURSOR_INIT_SCRIPT });
    await context.addInitScript({ content: actorBadgeInitScript("Klijent") });
    await preAcceptCookieConsent(context, BASE_URL);
    forwardPageDiagnostics(context, "Klijent");

    // recording effectively begins at newContext() - stashed on testInfo (shared
    // across every fixture for THIS test, not a global) so the `tut` fixture below
    // can compute each step's offset into this specific video without needing its
    // own separate fixture just to pass one number across.
    testInfo.__mainVideoStartedAt = Date.now();

    await use(context);

    // context.close() is what actually finalizes the .webm file on disk - Chromium
    // writes video frames throughout the run, but the file isn't valid/playable
    // until the recording is explicitly stopped here.
    await context.close();

    const files = await fs.readdir(tmpDir).catch(() => []);
    const videoFile = files.find((f) => f.endsWith(".webm"));
    if (videoFile) {
      const destDir = path.join(TUTORIALS_ROOT, "videos", scenarioId);
      await fs.ensureDir(destDir);
      await fs.move(path.join(tmpDir, videoFile), path.join(destDir, "full-flow.webm"), { overwrite: true });
    }
    await fs.remove(tmpDir);
  },

  tut: async ({ page }, use, testInfo) => {
    // testInfo.file is the scenario.spec.js path; its parent folder name is the
    // scenario id used throughout (screenshots/<id>/, scenarios/<id>/manifest.json,
    // generated/{sr,en}/<id>.md) - see e2e-tutorials/README.md.
    const scenarioId = path.basename(path.dirname(testInfo.file));
    const screenshotDir = path.join(TUTORIALS_ROOT, "screenshots", scenarioId);
    await fs.emptyDir(screenshotDir); // stale screenshots from a previous run must not linger if this run has fewer steps

    // a stale merged.webm/merged.*.vtt/merged.*.burned.webm from a PREVIOUS run's
    // scripts/merge-video.mjs or scripts/burn-subtitles.mjs would otherwise sit in
    // videos/<scenarioId>/ untouched by this run (which only (re)writes
    // full-flow.webm/admin-flow.webm etc, never merged.*/burned files itself) -
    // and build-docs.mjs prefers a burned file over merged.webm over the raw
    // per-actor files, so a fresh run's real videos would silently ship alongside
    // an old, now-mistimed merged/burned video pair. Removed here, at the START
    // of a run, not by merge-video.mjs/burn-subtitles.mjs themselves - neither
    // script has a way to know whether IT last produced the file it's about to
    // overwrite, or whether this fixture already invalidated it.
    await fs.remove(path.join(TUTORIALS_ROOT, "videos", scenarioId, "merged.webm"));
    for (const lang of ["sr", "en"]) {
      await fs.remove(path.join(TUTORIALS_ROOT, "videos", scenarioId, `merged.${lang}.vtt`));
      await fs.remove(path.join(TUTORIALS_ROOT, "videos", scenarioId, `merged.${lang}.burned.webm`));
    }

    let counter = 0;
    const manifest = [];

    /**
     * `page` (3rd arg) - which page to screenshot/wait-on for THIS step. Defaults
     * to the fixture's own `page`, but a scenario with a second actor in their own
     * context (e.g. an admin) MUST pass their page explicitly here. Before this
     * fix, every step always screenshotted the fixture's `page` regardless of
     * which page `fn` actually acted on - so every "admin-..." step in a scenario
     * like zakazivanje-termina was silently capturing whatever the CUSTOMER's page
     * happened to be showing at that moment, not the admin panel at all.
     *
     * `video` (4th arg) - `{ label, startedAt }` identifying which recording this
     * step's timestamp is relative to. Defaults to the main page's own recording
     * (see the `context` fixture's testInfo.__mainVideoStartedAt above). A second
     * actor's own context (see newRecordedContext below) returns its own
     * `startedAt` for exactly this - each video's steps need offsets measured from
     * THAT video's own start, not the main page's, or timestamps for
     * scripts/build-subtitles.mjs would point at the wrong moment entirely.
     */
    const step = async (id, fn, { page: targetPage = page, video = { label: "full-flow", startedAt: testInfo.__mainVideoStartedAt } } = {}) => {
      return test.step(id, async () => {
        // captured HERE, before fn() runs - not after fn()+networkidle settle (the
        // earlier version). That measured the wrong moment: `waitForLoadState`
        // below can sit for its FULL 3s timeout on any page with lingering
        // background activity (a poll, a pending analytics ping) that never truly
        // goes idle, so a step's timestamp could land up to 3s after the actual
        // on-screen action - subtitles appearing noticeably late on exactly those
        // steps, and (since the NEXT step's own timestamp isn't delayed the same
        // way) the PREVIOUS cue's effective on-screen duration getting squeezed
        // short right after - both complaints traced back to this one measurement
        // point. Timing it at the top of the step instead ties the cue's start to
        // the moment the narrated action actually BEGINS, and its duration
        // (start of the NEXT step's timestamp minus this one) now covers this
        // step's entire real duration - action + settle + the pacing pause below -
        // consistently, regardless of how long any individual networkidle wait
        // happens to take.
        const videoOffsetMs = Date.now() - video.startedAt;

        const result = await fn();

        // networkidle (not a fixed delay) so the SCREENSHOT (a still image, not
        // the caption timing above) reflects the settled page - a coupon-apply or
        // slot-fetch fires an async request that a screenshot taken immediately
        // after the triggering click would race against and sometimes catch
        // mid-spinner. Best-effort: a step whose last action doesn't trigger any
        // network activity would otherwise time out here for no reason.
        await targetPage.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

        counter += 1;
        const filename = `${String(counter).padStart(2, "0")}-${id}.png`;
        await targetPage.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });

        // deliberately after the screenshot, not before - the screenshot itself
        // should reflect the step's end state as soon as it's settled; this pause
        // only affects the VIDEO's pacing (giving a viewer time to read the
        // resulting screen), not when the still image is captured.
        await targetPage.waitForTimeout(STEP_PAUSE_MS);

        manifest.push({
          id,
          order: counter,
          // relative to TUTORIALS_ROOT (e2e-tutorials/), NOT to manifest.json's own
          // location - build-docs.mjs resolves this against wherever it's actually
          // embedding the image (generated/sr/, generated/en/), so the link stays
          // correct regardless of how deep either side of that relationship is nested.
          screenshot: path.posix.join("screenshots", scenarioId, filename),
          video: video.label,
          videoOffsetMs,
        });

        return result;
      });
    };

    await use({ step });

    // written on every run (pass or fail) so a scenario that dies partway through
    // still produces a manifest covering the steps it did reach, rather than
    // leaving build-docs.mjs with nothing at all to work from for that scenario.
    const manifestPath = path.join(TUTORIALS_ROOT, "scenarios", scenarioId, "manifest.json");
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  },
});

export { expect } from "@playwright/test";

/**
 * For scenarios with a SECOND actor in their own BrowserContext (e.g. an admin
 * confirming what the customer just booked) - the `context` fixture override
 * above only covers the default `page`'s context, since a manually-created
 * `browser.newContext()` bypasses fixtures entirely. Mirrors that same
 * record-then-finalize-then-move logic so the second actor's steps also end up
 * as a real video, saved as videos/<scenarioId>/<label>.webm.
 *
 * `actorLabel` (defaults to "Administrator", true for every current call site)
 * is the on-screen badge text (see actorBadgeInitScript) - kept separate from
 * `label`, which names the output FILE and is used in id-generation contexts, so
 * a display string with spaces/different casing never has to double as a
 * filesystem-safe identifier.
 */
export async function newRecordedContext(browser, scenarioId, label, actorLabel = "Administrator") {
  const tmpDir = path.join(TUTORIALS_ROOT, ".video-tmp", `${scenarioId}-${label}-${Date.now()}`);
  await fs.ensureDir(tmpDir);
  const context = await browser.newContext({
    recordVideo: { dir: tmpDir, size: VIDEO_SIZE },
  });
  await context.addInitScript({ content: CURSOR_INIT_SCRIPT });
  await context.addInitScript({ content: actorBadgeInitScript(actorLabel) });
  await preAcceptCookieConsent(context, BASE_URL);
  forwardPageDiagnostics(context, actorLabel);
  const startedAt = Date.now(); // see tut fixture's matching testInfo.__mainVideoStartedAt comment - same idea, own recording

  const finalize = async () => {
    await context.close();
    const files = await fs.readdir(tmpDir).catch(() => []);
    const videoFile = files.find((f) => f.endsWith(".webm"));
    if (videoFile) {
      const destDir = path.join(TUTORIALS_ROOT, "videos", scenarioId);
      await fs.ensureDir(destDir);
      await fs.move(path.join(tmpDir, videoFile), path.join(destDir, `${label}.webm`), { overwrite: true });
    }
    await fs.remove(tmpDir);
  };

  return { context, finalize, video: { label, startedAt } };
}

/**
 * Types into a field character-by-character, like a real person, instead of
 * `locator.fill()` - which sets the DOM value in one instant, invisible frame with
 * no keystroke events at all. In a video that reads as text just popping into
 * existence, which is what looked "off"/unnatural about the first cut of these
 * tutorials. Use this in scenario.spec.js files for any field a viewer is meant to
 * actually watch being filled in (email, phone, coupon code, etc.) - not a
 * wholesale replacement for `.fill()` everywhere, since a field the narration
 * doesn't call attention to doesn't need the extra recorded seconds.
 *
 * `delay` is per-keystroke, in ms - the default (~110ms) times launchOptions.slowMo
 * on top of it is what actually produces a natural-looking typing speed on
 * playback; tune this per call for a longer/shorter value worth lingering on.
 */
export async function typeSlowly(locator, text, { delay = 110 } = {}) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}
