import "dotenv/config";
import mongoose from "mongoose";
import { seedProductCatalog } from "./product-catalog.seed.js";

/**
 * Run once with: node src/database/seeds/run-product-seed.js
 * Uses the same MONGO_URI your app already connects with (via .env).
 *
 * Same rationale as run-esma-seed.js: plain console.log/console.error instead
 * of logInfo/logError, since pino-pretty's worker thread can lose buffered
 * output when a short-lived CLI script exits before it flushes.
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

    console.log("→ Seeding product catalog (equipment + Tiferono skincare)...");
    const summary = await seedProductCatalog();
    console.log("✓ Done:", summary);
    console.log("\n⚠ Svi proizvodi su seedovani kao DRAFT (isActive: false) sa placeholder");
    console.log("  cenama (12345 RSD) i količinom na stanju 0. Pre nego što ih objavite:");
    console.log("  1. Dodajte prave fotografije (trenutno su placehold.co slike)");
    console.log("  2. Unesite prave cene i količinu na stanju za svaku varijantu");
    console.log("  3. Odlučite da li ~45 profesionalnih uređaja uopšte treba da budu");
    console.log("     u javnoj prodavnici sa \"dodaj u korpu\" tokom (vidi napomenu na");
    console.log("     vrhu product-catalog.seed.js)");
    console.log("  4. Tek onda postavite isActive: true za svaki proizvod koji objavljujete");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to seed product catalog:");
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