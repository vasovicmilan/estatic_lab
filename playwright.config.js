import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Playwright's own process (config loading, test discovery/`--list`, and the spec
// files themselves as they run) never automatically gets .env.test's values -
// only the webServer child process does, via its own explicit
// `--env-file=.env.test` flag (see the `command` below). Without this, any spec
// (or helper it imports) that transitively pulls in src/services/crypto.service.js
// - which validates JWT_SECRET/AES_SECRET at import time - throws immediately,
// with no test ever running. Loaded here, at the top of config, so it's in effect
// before test files are even discovered.
dotenv.config({ path: ".env.test" });

const PORT = process.env.E2E_PORT || 4100;
const BASE_URL = `http://localhost:${PORT}`;

// One real headless browser driving real HTTP requests against a real (in-memory)
// MongoDB-backed Express server - complementary to test/integration's supertest-based
// HTTP tests, not a replacement. Integration tests hit controllers directly through
// Express's request/response cycle in-process; these instead verify what a person
// actually experiences through a browser - full page renders, form submissions,
// redirects, session cookies, and multi-page flows (e.g. customer checkout -> admin
// action -> customer confirmation) that no single HTTP request can exercise alone.
export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // suites share one Mongo instance/server process - avoid cross-test data collisions
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Playwright spawns this command, waits for the port to accept connections, runs
  // the test suite against it, then tears the process down - same lifecycle
  // test/integration/setup/test-app.js's createTestApp/closeTestApp provide for
  // supertest, just as a real listening server instead of an in-process app instance.
  webServer: {
    command: "node --env-file=.env.test test/e2e/setup/start-server.js",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});