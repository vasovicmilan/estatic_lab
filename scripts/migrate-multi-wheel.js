// One-off migration for "više točkova" (multiple prize wheels).
//
//   node scripts/migrate-multi-wheel.js            # DRY RUN - prints what it would do, writes nothing
//   node scripts/migrate-multi-wheel.js --apply    # does it
//
// What it does (idempotent - safe to run twice):
//   1. creates the default wheel (slug "tocak", served at /tocak) when there is none
//   2. assigns every existing prize and every existing lead (contact) to it
//   3. drops the OLD unique indexes on leads (email_1, phone.hash_1) - they would stop the same
//      person from spinning a second wheel - and builds the new ones: (wheel,email) and
//      (wheel,phone.hash) unique
//
// RUN IT ON A COPY OF THE DATABASE FIRST (mongodump / mongorestore into another db name, point
// MONGO_URI at it), check the printed summary, only then run it on production.
// Take a backup before --apply on production: `node scripts/backup.js`.
import mongoose from "mongoose";

// declared indexes must not be built behind our back during a dry run
mongoose.set("autoIndex", false);

const { withDb } = await import("./_bootstrap.js");
const apply = process.argv.includes("--apply");

await withDb("migrate-multi-wheel", async () => {
  const { default: Lead } = await import("../src/models/lead.model.js");
  const { default: WheelPrize } = await import("../src/models/wheel-prize.model.js");
  const { default: Wheel, DEFAULT_WHEEL_SLUG } = await import("../src/models/wheel.model.js");
  const { ensureDefaultPrizes } = await import("../src/services/wheel.service.js");
  const wheelPrizeRepo = (await import("../src/repositories/wheel-prize.repository.js")).default;
  const leadRepo = (await import("../src/repositories/lead.repository.js")).default;

  const say = (msg) => console.log(`${apply ? "[APPLY]" : "[DRY RUN]"} ${msg}`);

  const orphanPrizes = await WheelPrize.collection.countDocuments({ wheel: { $exists: false } });
  const orphanLeads = await Lead.collection.countDocuments({ wheel: { $exists: false } });
  const wheels = await Wheel.countDocuments({});
  say(`wheels=${wheels}, prizes without wheel=${orphanPrizes}, leads without wheel=${orphanLeads}`);

  const indexes = await Lead.collection.indexes();
  const oldUnique = indexes.filter((i) => i.unique && (i.name === "email_1" || i.name === "phone.hash_1"));
  say(`old unique indexes on leads: ${oldUnique.map((i) => i.name).join(", ") || "none"}`);

  if (!apply) {
    say("nothing written. Run with --apply (on a database COPY first).");
    return;
  }

  mongoose.set("autoIndex", true);
  await ensureDefaultPrizes(); // creates the default wheel (or adopts existing prizes/leads when none exists)
  const defaultWheel = await Wheel.findOne({ slug: DEFAULT_WHEEL_SLUG }).lean();
  if (!defaultWheel) throw new Error("Default wheel was not created");
  const p = await wheelPrizeRepo.assignOrphanPrizesToWheel(defaultWheel._id);
  const l = await leadRepo.assignOrphanLeadsToWheel(defaultWheel._id);
  say(`assigned to "${defaultWheel.slug}": prizes=${p.modifiedCount}, leads=${l.modifiedCount}`);

  for (const index of oldUnique) {
    await Lead.collection.dropIndex(index.name);
    say(`dropped index ${index.name}`);
  }
  await Lead.createIndexes();
  await WheelPrize.createIndexes();
  await Wheel.createIndexes();

  const left = {
    prizes: await WheelPrize.collection.countDocuments({ wheel: { $exists: false } }),
    leads: await Lead.collection.countDocuments({ wheel: { $exists: false } }),
  };
  say(`left without wheel: prizes=${left.prizes}, leads=${left.leads} (must be 0)`);
  say(`lead indexes now: ${(await Lead.collection.indexes()).map((i) => `${i.name}${i.unique ? "(unique)" : ""}`).join(", ")}`);
  if (left.prizes || left.leads) throw new Error("Some documents still have no wheel");
});
