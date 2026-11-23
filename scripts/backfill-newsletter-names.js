// One-off: copy the first name from a wheel Lead onto the matching newsletter subscriber (same
// e-mail), so campaigns can greet people with {{ime}}. Only fills EMPTY names, never overwrites.
//
//   node scripts/backfill-newsletter-names.js            # dry run - only prints what it would do
//   node scripts/backfill-newsletter-names.js --apply    # actually writes
import { withDb } from "./_bootstrap.js";
import Lead from "../src/models/lead.model.js";
import NewsLetter from "../src/models/news-letter.model.js";

const apply = process.argv.includes("--apply");

await withDb("backfill-newsletter-names", async () => {
  const leads = await Lead.find({}, { email: 1, firstName: 1 }).lean();
  let matched = 0;
  let updated = 0;

  for (const lead of leads) {
    const firstName = (lead.firstName || "").trim().slice(0, 60);
    if (!firstName) continue;

    const subscriber = await NewsLetter.findOne({ email: lead.email }, { firstName: 1 }).lean();
    if (!subscriber) continue;
    matched += 1;
    if (subscriber.firstName) continue;

    updated += 1;
    if (apply) await NewsLetter.updateOne({ _id: subscriber._id, $or: [{ firstName: null }, { firstName: { $exists: false } }, { firstName: "" }] }, { $set: { firstName } });
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN"}: leads=${leads.length}, with a subscriber=${matched}, names ${apply ? "written" : "to write"}=${updated}`);
});
