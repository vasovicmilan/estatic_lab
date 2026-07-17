import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { clear } from "node:console";
import fs from "fs-extra";
import path from "path";
import os from "os";

let mongoServer;
let uploadTempDir;

export async function createTestApp() {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongoServer.getUri();

    uploadTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "Estatik-lab-uploads-"));
  for (const sub of ["services", "packages", "categories", "posts", "testimonials", "experts", "site", "videos/thumbnails"]) {
    await fs.ensureDir(path.join(uploadTempDir, "images", sub));
  }
  await fs.ensureDir(path.join(uploadTempDir, "videos", "thumbnails"));
  process.env.UPLOAD_PUBLIC_PATH = uploadTempDir;

  const { default: app } = await import("../../../src/app.js");

  await mongoose.connect(mongoServer.getUri());
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

  return app;
}

export async function closeTestApp() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
  if (uploadTempDir) await fs.remove(uploadTempDir).catch(() => {});
  process.exit(0);
}

export async function clearTestDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export default { createTestApp, closeTestApp, clearTestDatabase };