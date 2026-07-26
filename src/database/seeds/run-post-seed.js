import "dotenv/config";
import mongoose from "mongoose";
import { seedPostContent } from "./post-content.seed.js";

/**
 * Run once with: node src/database/seeds/run-post-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * Optional: set POST_SEED_AUTHOR_EMAIL in .env to a specific user's email if you
 * want a particular admin/employee credited as the author. Otherwise the seed
 * uses the earliest-created "admin"-role user it finds.
 *
 * NOTE: this deliberately uses plain console.log/console.error instead of the
 * app's logInfo/logError, same reasoning as run-esma-seed.js - pino's worker
 * thread transport can lose buffered output if the process exits too fast for
 * a short-lived CLI script.
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

    console.log("→ Seeding blog post content (categories, tags, posts)...");
    const summary = await seedPostContent();
    console.log("✓ Done:", summary);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed post content:");
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