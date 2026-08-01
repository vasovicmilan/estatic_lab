import "dotenv/config";
import mongoose from "mongoose";
import { backfillServiceResources } from "./backfill-service-resources.seed.js";
import { logInfo, logError } from "../../utils/logger.util.js";

/**
 * Run once with: node src/database/seeds/run-backfill-service-resources.js
 *
 * Run AFTER run-resource-seed.js (or after creating the two resources by hand
 * via /admin/resursi with the same IDs) so the assignment points at resources
 * that actually exist. Safe to re-run - it only ever sets `resources` to the
 * same fixed value per slug, nothing accumulates or duplicates.
 */
async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected (service resources backfill run)");

    const results = await backfillServiceResources();
    logInfo("Done", { updated: results.length, services: results });
  } catch (error) {
    logError("Failed to backfill service resources", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();