import "dotenv/config";
import mongoose from "mongoose";
import { seedEsmaCatalog } from "./esma-catalog.seed.js";
import { logInfo, logError } from "../../utils/logger.util.js";

/**
 * Run once with: node src/database/seeds/run-esma-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 */
async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected (ESMA seed run)");

    const summary = await seedEsmaCatalog();
    logInfo("Done", summary);
  } catch (error) {
    logError("Failed to seed ESMA catalog", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();