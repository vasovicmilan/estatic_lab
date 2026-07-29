import "dotenv/config";
import mongoose from "mongoose";
import { seedPremiumComboPackages } from "./premium-combo-packages.seed.js";

/**
 * Run once with: node src/database/seeds/run-premium-combo-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * IMPORTANT: run run-esma-seed.js first (or confirm it's already been run in
 * production) - this seed looks up existing services/variants by slug and
 * throws if any of them don't exist yet, rather than silently creating
 * incomplete packages.
 *
 * NOTE: this deliberately uses plain console.log/console.error instead of
 * the app's logInfo/logError - see run-esma-seed.js for why (pino-pretty's
 * worker thread can lose buffered output when a short-lived CLI script exits).
 */
async function run() {
  const uri = process.env.MONGO_URI;
  console.log(`→ MONGO_URI set: ${uri ? "yes" : "NO - missing from .env!"}`);
  if (!uri) {
    console.error("✗ MONGO_URI is not set. Check your .env file (project root) and that dotenv is picking it up.");
    process.exit(1);
  }

  try {
    console.log("→ Connecting to MongoDB...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log("✓ MongoDB connected");

    console.log("→ Seeding premium ESMA + masaža kombo pakete...");
    const summary = await seedPremiumComboPackages();
    console.log("✓ Done:", summary);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed premium combo packages:");
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