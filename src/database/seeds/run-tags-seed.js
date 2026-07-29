import "dotenv/config";
import mongoose from "mongoose";
import { seedTags } from "./tags.seed.js";

/**
 * Run once with: node src/database/seeds/run-tags-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 */
async function run() {
  const uri = process.env.MONGO_URI;
  console.log(`→ MONGO_URI set: ${uri ? "yes" : "NO - missing from .env!"}`);
  if (!uri) {
    console.error("✗ MONGO_URI is not set. Check your .env file (project root).");
    process.exit(1);
  }

  try {
    console.log("→ Connecting to MongoDB...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log("✓ MongoDB connected");

    console.log("→ Seeding benefit tags...");
    const tagIdMap = await seedTags();

    console.log("\n📋 Copy this map into your product seed file:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(tagIdMap, null, 2));

    await mongoose.connection.close();
    console.log("✓ Done.");
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed tags:");
    console.error(error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

run();