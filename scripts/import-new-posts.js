// Uvoz 17 novih blog objava (2 objavljene, 14 zakazanih, 1 nacrt) + potrebne kategorije i tagovi.
// Pokretanje iz korena projekta:
//   node scripts/import-new-posts.js --selftest   (bez baze: proverava fajlove i mapiranje)
//   node scripts/import-new-posts.js --dry        (povezuje se na bazu, ništa ne upisuje)
//   node scripts/import-new-posts.js              (stvarni uvoz)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const { EJSON, ObjectId } = mongoose.mongo.BSON;
const here = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const SELFTEST = process.argv.includes("--selftest");

const posts = EJSON.parse(fs.readFileSync(path.join(here, "new_posts.json"), "utf8"));
const tax = EJSON.parse(fs.readFileSync(path.join(here, "new_taxonomy.json"), "utf8"));
if (posts.length !== 17) throw new Error(`Očekivano 17 objava, a ima ${posts.length}`);

// placeholder _id -> pravi _id (postojeći ili novi)
function remap(idMap) {
  for (const p of posts) {
    p.categories = p.categories.map((id) => idMap.get(String(id)) ?? id);
    p.tags = p.tags.map((id) => idMap.get(String(id)) ?? id);
  }
}

if (SELFTEST) {
  const m = new Map(tax.map((t) => [String(t._id), new ObjectId()]));
  remap(m);
  const unresolved = posts.flatMap((p) => [...p.categories, ...p.tags]).filter((id) => !new Set([...m.values()].map(String)).has(String(id)));
  console.log("Objava:", posts.length, "| kategorija/tagova:", tax.length, "| nerazrešenih veza:", unresolved.length);
  console.log("Primer:", posts[0].slug, posts[0].status, posts[0].scheduledFor ?? posts[0].publishedAt);
  process.exit(unresolved.length ? 1 : 0);
}

const { default: Post } = await import("../src/models/post.model.js");
const { default: Category } = await import("../src/models/category.model.js");
const { default: Tag } = await import("../src/models/tag.model.js");

await mongoose.connect(process.env.MONGO_URI);
console.log("Baza:", mongoose.connection.name, DRY ? "(DRY RUN)" : "");

// 1) taksonomija: postojeće se pronalaze po slug+domain, nove se prave
const idMap = new Map();
const toCreate = [];
for (const t of tax) {
  const Model = t.kind === "category" ? Category : Tag;
  const found = await Model.collection.findOne({ slug: t.slug, domain: t.domain }, { projection: { _id: 1 } });
  if (found) idMap.set(String(t._id), found._id);
  else { idMap.set(String(t._id), t._id); toCreate.push(t); }
}
console.log(`Taksonomija: ${tax.length - toCreate.length} postojećih, ${toCreate.length} novih:`);
toCreate.forEach((t) => console.log("  +", t.kind, t.slug));

// 2) provera sukoba slugova
const slugs = posts.map((p) => p.slug);
const clash = await Post.collection.find({ slug: { $in: slugs } }, { projection: { slug: 1 } }).toArray();
if (clash.length) {
  console.log("SLUG VEĆ POSTOJI u bazi:", clash.map((c) => c.slug));
  if (!DRY) throw new Error("Prekidam: slug već postoji.");
}
console.log("Objave za dodavanje:");
posts.forEach((p) => console.log("  -", p.status.padEnd(9), (p.scheduledFor ?? p.publishedAt)?.toISOString?.().slice(0, 10) ?? "-", p.slug));

if (!DRY) {
  const now = new Date();
  for (const t of toCreate) {
    if (t.kind === "category") {
      await Category.collection.insertOne({ _id: t._id, name: t.name, slug: t.slug, domain: t.domain, parent: null, shortDescription: "", content: [], isIndexable: true, meta: { priority: 0, isActive: true }, createdAt: now, updatedAt: now, __v: 0 });
    } else {
      // novi tagovi sa jednom objavom nisu vredni indeksiranja (tanka arhiva); uključite u adminu kad imaju više objava
      await Tag.collection.insertOne({ _id: t._id, name: t.name, slug: t.slug, domain: t.domain, isActive: true, isIndexable: false, createdAt: now, updatedAt: now, __v: 0 });
    }
  }
  remap(idMap);
  await Post.collection.insertMany(posts);
  console.log(`Gotovo: ${posts.length} objava, ${toCreate.length} novih kategorija/tagova.`);
}
await mongoose.disconnect();
