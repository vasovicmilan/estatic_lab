import "dotenv/config";
import mongoose from "mongoose";
import { seedResources } from "./resource.seed.js";
import { logInfo, logError } from "../../utils/logger.util.js";

/**
 * Run once with: node src/database/seeds/run-resource-seed.js
 *
 * Creates the initial "Sto za masažu" and "ESMA aparat" Resource documents if
 * they don't already exist (safe to re-run - uses $setOnInsert, so it will
 * never overwrite a capacity/isActive value you've since changed via
 * /admin/resursi). Run this once after deploying the resource-capacity
 * feature, then also run run-roles-seed.js so the admin role picks up the new
 * "manage_resources" permission and /admin/resursi becomes visible.
 */
async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected (resource seed run)");

    const resources = await seedResources();
    logInfo("Done", { resources: resources.map((r) => ({ name: r.name, capacity: r.capacity })) });
  } catch (error) {
    logError("Failed to seed resources", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();