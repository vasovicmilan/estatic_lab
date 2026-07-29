import "dotenv/config";
import mongoose from "mongoose";
import { seedAllBlogContent } from "./blog-posts.seed.js";

/**
 * Run once with: node src/database/seeds/run-all-blog-content-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * This REPLACES the previous 6-file/6-runner setup (post-content.seed.js +
 * pillar-a/b/c/d/e.seed.js and their run-*.js scripts) with a single file and
 * a single run, so this is one commit/one file to review instead of six.
 *
 * Safe to run multiple times (idempotent):
 *   - Categories/tags are upserted by (slug, domain) - re-running never
 *     duplicates them.
 *   - Posts are upserted by slug, EXCEPT: if a post is ALREADY "published" in
 *     the DB (e.g. the publish-scheduled-posts cron already flipped it, or
 *     you hand-edited it in the admin after it went live), this seed skips
 *     it entirely on re-run - no field is touched, not content, not SEO, not
 *     categories/tags. Only posts still "draft"/"scheduled" (or not yet
 *     created) get written. See the skip-guard comment inside upsertPosts()
 *     in all-blog-content.seed.js.
 *
 * ⚠️ 3 of the 56 posts still contain [POPUNI: ...] placeholder text you need
 * to fill in before their scheduledFor date arrives, or they'll auto-publish
 * with visible placeholder text:
 *   - "estetski-wellness-centar-u-novom-sadu" - radno vreme, parking, prevoz
 *   - "kako-do-nas-parking-i-prevoz" - opcije parkinga, linije prevoza, pristupačnost
 *   - "iskustva-klijenata-sta-govore" - PRAVI citati klijenata (uz dozvolu), ne izmišljeni
 * The address itself (Maksima Gorkog 6b, Novi Sad, blizu Spensa i zgrade suda)
 * is already filled in correctly.
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

    console.log("→ Seeding all blog content (categories, tags, 56 posts)...");
    const summary = await seedAllBlogContent();
    console.log("✓ Done:", summary);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed blog content:");
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