import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { clear } from "node:console";
import fs from "fs-extra";
import path from "path";
import os from "os";

let mongoServer;
let uploadTempDir;
let currentApp;

export async function createTestApp() {
  // Belt-and-suspenders alongside package.json's "NODE_ENV=test" prefix: this
  // line guarantees it regardless of HOW the test command ends up invoked
  // (a shell with NODE_ENV already exported, an IDE test runner, a CI step
  // that doesn't go through the npm script) - app.js is imported dynamically
  // a few lines below, specifically so this runs first. Middlewares that gate
  // on NODE_ENV === "test" (see rate-limiter.middleware.js's skipInTest) read
  // process.env fresh on every request, not just at import time, so setting
  // it here - before app.js and everything it imports ever gets evaluated -
  // is sufficient no matter what the outer environment looked like.
  process.env.NODE_ENV = "test";

  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongoServer.getUri();

    uploadTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "Estetik-lab-uploads-"));
  for (const sub of ["services", "packages", "categories", "posts", "testimonials", "experts", "site", "videos/thumbnails"]) {
    await fs.ensureDir(path.join(uploadTempDir, "images", sub));
  }
  await fs.ensureDir(path.join(uploadTempDir, "videos", "thumbnails"));
  process.env.UPLOAD_PUBLIC_PATH = uploadTempDir;

  // Cache-busting query string: Node's ES module cache keys on the exact
  // specifier string, so a plain "../../../src/app.js" import would return the
  // SAME cached module (and therefore the SAME Express app / session store)
  // for every describe block in a file that calls createTestApp() more than
  // once (api-v1-admin-appointment-order.http.test.js,
  // api-v1-employee-partner.http.test.js). That used to silently reuse a
  // session store whose MongoStore client was still bound to the FIRST
  // block's mongoServer URI - once that block's after() stopped its replset,
  // the second block's session-based requests (registerAndLogin's CSRF/login
  // POSTs) would hang for ~30s per request waiting on serverSelectionTimeoutMS
  // against a server that no longer exists, fail silently, and leave
  // registerAndLogin reading ._id off a null user. Forcing a fresh module
  // instance per call - app.js re-runs its top-level setup, including a brand
  // new setupSession(app) bound to THIS call's freshly-set MONGO_URI - makes
  // every createTestApp()/closeTestApp() pair fully independent, exactly like
  // every other single-describe-block test file already behaves. Only app.js
  // itself is bypassed; everything it imports (routes, models, mongoose
  // itself) resolves normally through Node's regular module cache, so
  // singletons like compiled Mongoose models are unaffected.
  const { default: app } = await import(`../../../src/app.js?instance=${Date.now()}-${Math.random()}`);
  currentApp = app;

  await mongoose.connect(mongoServer.getUri());
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

  return app;
}

export async function closeTestApp() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
  if (uploadTempDir) await fs.remove(uploadTempDir).catch(() => {});

  // The root cause of the hang from removing process.exit(0): MongoStore
  // (session.config.js) opens its OWN native MongoClient, entirely separate
  // from the mongoose connection closed above. Nothing else ever closed it,
  // so its driver keepalive/heartbeat kept the event loop alive forever once
  // process.exit(0) stopped papering over it. Now that createTestApp() always
  // hands back a fresh app/store pair (see the cache-busting import above),
  // this can unconditionally close the CURRENT call's own store every time -
  // no cross-describe-block sharing, so nothing else depends on this store
  // staying open.
  if (currentApp) {
    const store = currentApp.get("sessionStore");
    if (store && typeof store.close === "function") {
      await store.close();
    }
  }
}

export async function clearTestDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export default { createTestApp, closeTestApp, clearTestDatabase };
