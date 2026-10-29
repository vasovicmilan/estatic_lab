import { test } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { run } from "../../flows/provizija-za-paket-sa-preporukom.flow.js";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Tutorial scenario (računar, 1920x1080). The whole story lives in e2e-tutorials/flows/provizija-za-paket-sa-preporukom.flow.js -
 * this file only picks the device, so the phone version can never drift from it.
 * Narration: narration.json.
 */
const SCENARIO_ID = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const MOBILE = false;

test.describe("Tutorial: provizija za paket sa preporukom partnera", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("provizija partnera i zaposlenog se ispravno obračunavaju kad se popust kupona i popust paketa saberu", async ({ page, browser, tut }) => {
    test.slow();
    await run({ page, browser, tut, mobile: MOBILE, scenarioId: SCENARIO_ID });
  });
});
