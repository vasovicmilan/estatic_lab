import "dotenv/config";
import mongoose from "mongoose";
import { seedRoles } from "./roles.seed.js";
import { logInfo, logError } from "../../utils/logger.util.js";

/**
 * Run once with: node src/database/seeds/run-roles-seed.js
 *
 * IMPORTANT: run this after deploying the permission-based roles change. The
 * existing "admin" role document in your database doesn't have the new
 * "access_admin_panel" permission yet - without it, admin.middleware.js will lock
 * your own admin account out of /admin the next time you log in.
 */
async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected (roles seed run)");

    const roles = await seedRoles();
    logInfo("Done", { roles: roles.map((r) => ({ name: r.name, permissions: r.permissions })) });
  } catch (error) {
    logError("Failed to seed roles", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();