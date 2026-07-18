import "dotenv/config";
import mongoose from "mongoose";
import { logInfo, logError } from "../src/utils/logger.util.js";

export async function withDb(scriptName, fn) {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await fn();
    logInfo(`[${scriptName}] Completed successfully`);
    process.exitCode = 0;
  } catch (error) {
    logError(`[${scriptName}] Failed`, error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}