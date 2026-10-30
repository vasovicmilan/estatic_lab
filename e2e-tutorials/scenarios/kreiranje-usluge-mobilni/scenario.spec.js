import { test } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { run } from "../../flows/kreiranje-usluge.flow.js";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Tutorial scenario (telefon, 390x844). The whole story lives in e2e-tutorials/flows/kreiranje-usluge.flow.js -
 * this file only picks the device, so the computer version can never drift from it.
 * Narration: narration.json (extends the computer version - see scripts/lib/narration.mjs).
 */
const SCENARIO_ID = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const MOBILE = true;

test.describe("Tutorial: kreiranje usluge (telefon)", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("admin kreira uslugu kroz tri faze", async ({ page, browser, tut }) => {
    test.slow();
    await run({ page, browser, tut, mobile: MOBILE, scenarioId: SCENARIO_ID });
  });
});
