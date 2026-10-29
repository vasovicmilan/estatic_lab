import { test } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { run } from "../../flows/kupovina-proizvoda-sa-kuponom.flow.js";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Tutorial scenario (telefon, 390x844). The whole story lives in e2e-tutorials/flows/kupovina-proizvoda-sa-kuponom.flow.js -
 * this file only picks the device, so the computer version can never drift from it.
 * Narration: narration.json (extends the computer version - see scripts/lib/narration.mjs).
 */
const SCENARIO_ID = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const MOBILE = true;

test.describe("Tutorial: kupovina proizvoda sa kuponom (telefon)", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("klijent kupuje proizvod i primenjuje kupon na naplati (telefon)", async ({ page, browser, tut }) => {
    test.slow();
    await run({ page, browser, tut, mobile: MOBILE, scenarioId: SCENARIO_ID });
  });
});
