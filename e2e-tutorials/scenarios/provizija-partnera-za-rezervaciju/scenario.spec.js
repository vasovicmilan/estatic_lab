import { test } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { run } from "../../flows/provizija-partnera-za-rezervaciju.flow.js";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Tutorial scenario (računar, 1920x1080). The whole story lives in e2e-tutorials/flows/provizija-partnera-za-rezervaciju.flow.js -
 * this file only picks the device, so the phone version can never drift from it.
 * Narration: narration.json.
 */
const SCENARIO_ID = path.basename(path.dirname(fileURLToPath(import.meta.url)));
const MOBILE = false;

test.describe("Tutorial: provizija partnera za rezervaciju termina", () => {
  test.use({ tutorialDevice: MOBILE ? "mobile" : "desktop" });

  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("partner zarađuje proviziju po stopi za usluge, ne za proizvode, preko rezervisanog termina", async ({ page, browser, tut }) => {
    test.slow();
    await run({ page, browser, tut, mobile: MOBILE, scenarioId: SCENARIO_ID });
  });
});
