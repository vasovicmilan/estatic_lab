import redirectRepo from "../../repositories/redirect.repository.js";
import { logInfo } from "../../utils/logger.util.js";

// The 5 URLs flagged in the 2026-09-17 log review - each served real content
// (200) until 09-14/09-15, then started 404ing, with no matching git commit
// in that window (the underlying tag/category was almost certainly
// edited/deleted through the admin panel, not a code change).
//
// Defaulted to "gone" (410) here because the actual replacement target for
// each isn't known yet - 410 is a safe default for previously-indexed URLs
// (tells search engines to drop them, rather than keep re-checking a 404).
// If any of these should actually 301 to a live page instead (the tag was
// renamed/merged, not removed), change that entry's `type` to "redirect" and
// set `target` to the real path, then re-run this script - upsertRedirect
// matches on sourcePath, so re-running is safe.
const entries = [
  { sourcePath: "/blog/tag/relax-masaza-novi-sad", type: "gone" },
  { sourcePath: "/usluge/tag/esma-i-masaza", type: "gone" },
  { sourcePath: "/blog/tag/kozmeticki-salon-novi-sad", type: "gone" },
  { sourcePath: "/blog/tag/spens-novi-sad", type: "gone" },
  { sourcePath: "/prodavnica/kategorija/oziljci-tvorevine-depilacija", type: "gone" },
];

export async function seedDeadUrls() {
  const results = [];
  for (const entry of entries) {
    const saved = await redirectRepo.upsertRedirect(entry);
    results.push(saved);
  }
  return results;
}

async function run() {
  const mongoose = (await import("mongoose")).default;
  await import("dotenv/config");
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logInfo("MongoDB connected (dead-urls seed run)");
    const results = await seedDeadUrls();
    logInfo("Done", { entries: results.map((r) => ({ sourcePath: r.sourcePath, type: r.type })) });
  } finally {
    await mongoose.connection.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
