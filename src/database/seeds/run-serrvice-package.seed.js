import "dotenv/config";
import mongoose from "mongoose";
import { seedServicePackages } from "./service-packages.seed.js";

/**
 * Run once with: node src/database/seeds/run-service-packages.seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * IMPORTANT: run run-service-catalog.seed.js FIRST - this seed looks up
 * existing services/variants/tags by slug and throws if any of them don't
 * exist yet, rather than silently creating incomplete packages.
 *
 * Seeds all 24 Package documents: 18 single-service bundles ("N tretmana"
 * for the 6 base ESMA usluge + 4 hibridna protokola) and 6 premium
 * combinations (two different services, e.g. 5 ESMA + 3 masaže).
 *
 * NOTE: this deliberately uses plain console.log/console.error instead of
 * the app's logInfo/logError - see run-service-catalog.seed.js for why.
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

    console.log("→ Seeding service packages (18 bundlova + 6 premium kombinacija)...");
    const summary = await seedServicePackages();
    console.log("✓ Done:", summary);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed service packages:");
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