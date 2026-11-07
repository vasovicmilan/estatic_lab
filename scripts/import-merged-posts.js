// Uvoz spojenih blog objava + 301 preusmerenja.
// Pokretanje (iz korena projekta):
//   node scripts/import-merged-posts.js --dry     (samo prikaz, ništa se ne menja)
//   node scripts/import-merged-posts.js           (stvarni uvoz)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Post from "../src/models/post.model.js";
import Redirect from "../src/models/redirect.model.js";

const { EJSON } = mongoose.mongo.BSON;
const here = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");

const posts = EJSON.parse(fs.readFileSync(path.join(here, "posts_NOVO_49.json"), "utf8"));
const reds = JSON.parse(fs.readFileSync(path.join(here, "redirects.json"), "utf8"));
if (posts.length !== 49) throw new Error(`Očekivano 49 objava, a ima ${posts.length}`);

await mongoose.connect(process.env.MONGO_URI);
console.log("Baza:", mongoose.connection.name, DRY ? "(DRY RUN)" : "");

const keep = posts.map((p) => p._id);
const stale = await Post.collection.find({ _id: { $nin: keep } }, { projection: { slug: 1, status: 1 } }).toArray();
console.log(`Za uklanjanje (${stale.length}, treba 21):`);
stale.forEach((s) => console.log("  -", s.slug, `[${s.status}]`));
const missing = [];
for (const p of posts) if (!(await Post.collection.findOne({ _id: p._id }, { projection: { _id: 1 } }))) missing.push(p.slug);
console.log(`Nove objave koje ne postoje u bazi (${missing.length}):`, missing);

if (!DRY) {
  if (stale.length !== 21 && !process.argv.includes("--force")) {
    throw new Error("Broj objava za uklanjanje nije 21. Prekidam. (--force da ignorišete)");
  }
  for (const p of posts) await Post.collection.replaceOne({ _id: p._id }, p, { upsert: true });
  await Post.collection.deleteMany({ _id: { $nin: keep } });
  for (const r of reds) await Redirect.updateOne({ sourcePath: r.sourcePath }, { $set: r }, { upsert: true });
  console.log(`Gotovo: ${posts.length} objava, ${reds.length} preusmerenja.`);
}
await mongoose.disconnect();
