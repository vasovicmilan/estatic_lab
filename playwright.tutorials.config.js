import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { VIDEO_SIZE } from "./e2e-tutorials/scripts/tutorial.fixture.js";

// Same reasoning as playwright.config.js's identical dotenv.config() call - see
// that file for why this has to happen here, at config load time, not inside a
// spec or fixture.
dotenv.config({ path: ".env.test" });

const PORT = process.env.E2E_TUTORIAL_PORT || 4200;
const BASE_URL = `http://localhost:${PORT}`;

// How much to slow down every Playwright action (click, fill, navigation) for a
// watchable video - real e2e specs run at full speed since nobody watches them;
// a tutorial video where every click and page load happens instantly is
// unwatchable. ~4x a normal test's pace landed around 400ms per action in a
// manual pass - tune this single constant up/down rather than hunting through
// every scenario file. Overridable via env var for a quick local experiment
// without editing this file.
const SLOW_MO_MS = Number(process.env.E2E_TUTORIAL_SLOWMO_MS || 400);

// Deliberately its own config, not a --grep filter on the real e2e suite: tutorial
// runs are slower (full-page screenshot after every step) and produce artifacts
// (screenshots/, generated/*.md) nobody wants mixed into a CI test-results dir or
// accidentally left stale by a partial `npx playwright test` run of the real
// suite. Points at its own port so it can safely run alongside (or instead of)
// the real e2e webServer without a port clash.
export default defineConfig({
  testDir: "./e2e-tutorials/scenarios",
  testMatch: "**/scenario.spec.js",
  // Was 60s (test.slow() -> 180s ceiling) - too tight once pacing was
  // deliberately slowed down (STEP_PAUSE_MS, slowMo, extra admin-nav steps).
  // 180s base -> 540s (9min) ceiling under test.slow(), comfortably above the
  // 3-5min target for the heaviest scenarios. Individual actions inside the new
  // admin-nav helpers (slow-actions.js's NAV_ACTION_TIMEOUT) have their own
  // short 10s timeout, so a genuinely broken selector still fails fast - this
  // larger ceiling is purely headroom for legitimate step-by-step pacing time.
  timeout: 180_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // a retry would re-run steps and silently overwrite/duplicate screenshots mid-numbering
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "off", // e2e-tutorials/scripts/tutorial.fixture.js takes its own full-page screenshots per step instead
    viewport: VIDEO_SIZE, // must match VIDEO_SIZE - see comment above
    launchOptions: {
      slowMo: SLOW_MO_MS,
    },
  },

  projects: [
    {
      name: "chromium",
      // devices["Desktop Chrome"] carries its own default `viewport` (its normal
      // device-emulation size) that would otherwise silently override the
      // top-level `use.viewport: VIDEO_SIZE` above, once merged in - explicit
      // override here keeps the two nested `use` blocks from fighting over
      // viewport size, which is exactly the kind of mismatch VIDEO_SIZE's own
      // comment warns causes blurry video.
      use: { ...devices["Desktop Chrome"], viewport: VIDEO_SIZE },
    },
  ],

  webServer: {
    command: `E2E_PORT=${PORT} node --env-file=.env.test test/e2e/setup/start-server.js`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
