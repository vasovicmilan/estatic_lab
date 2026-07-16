import "dotenv/config";
import mongoose from "mongoose";
import { seedEsmaCatalog } from "./esma-catalog.seed.js";

/**
 * Run once with: node src/database/seeds/run-esma-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * NOTE: this deliberately uses plain console.log/console.error instead of
 * the app's logInfo/logError. Those go through pino with a pino-pretty
 * transport that runs in a worker thread — for a short-lived CLI script
 * like this one, the process can exit before that worker thread flushes
 * its buffered writes, so both success AND error messages can silently
 * disappear. Plain console output is synchronous, so nothing gets lost.
 */
async function run() {
  const uri = process.env.MONGO_URI;
  console.log(`→ MONGO_URI set: ${uri ? "yes" : "NO — missing from .env!"}`);
  if (!uri) {
    console.error("✗ MONGO_URI is not set. Check your .env file (project root) and that dotenv is picking it up.");
    process.exit(1);
  }

  try {
    console.log("→ Connecting to MongoDB...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log("✓ MongoDB connected");

    console.log("→ Seeding ESMA + masaže catalog...");
    const summary = await seedEsmaCatalog();
    console.log("✓ Done:", summary);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed ESMA catalog:");
    console.error(error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors during failure cleanup
    }
    process.exit(1);
  }
}

run();