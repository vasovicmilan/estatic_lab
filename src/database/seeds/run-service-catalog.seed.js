import "dotenv/config";
import mongoose from "mongoose";
import { seedServiceCatalog } from "./service-catalog.seed.js";

/**
 * Run once with: node src/database/seeds/run-service-catalog.seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * Seeds the FULL service catalog: 5 categories (masaze, struja, esma, laser,
 * ultrazvuk), 45 tags, and all 14 services (6 ESMA Favorit tretmana, 4 ručne
 * masaže, 4 kombinovana ESMA+masaža protokola).
 *
 * Run this BEFORE run-service-packages.seed.js - the packages seed looks up
 * these services/variants/tags by slug and throws if they don't exist yet.
 *
 * NOTE: this deliberately uses plain console.log/console.error instead of
 * the app's logInfo/logError - pino-pretty's worker thread can lose buffered
 * output when a short-lived CLI script exits.
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

    console.log("→ Seeding service catalog (categories + tags + 14 services)...");
    const summary = await seedServiceCatalog();
    console.log("✓ Done:", { categories: summary.categories, tags: summary.tags, services: summary.services });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed service catalog:");
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