import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { seedRoles } from "../../../src/database/seeds/roles.seed.js";
import { logInfo, logError } from "../../../src/utils/logger.util.js";

const PORT = process.env.E2E_PORT || 4100;

/**
 * Real (in-memory) MongoDB + a real listening Express server - the E2E counterpart
 * to test/integration/setup/test-app.js. That file hands back an in-process app
 * instance for supertest, which never touches a real socket; Playwright drives an
 * actual browser, which needs an actual HTTP server it can navigate to. Everything
 * else (replica set for transactions, upload temp dir, model init) mirrors
 * test-app.js exactly, since the underlying app has the same requirements either way.
 */
async function start() {
  try {
    const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGO_URI = mongoServer.getUri();

    // written so a separate process (Playwright's own spec-runner process, not this
    // spawned webServer process) can connect to the exact same in-memory database -
    // see test/e2e/helpers/db.js's connectDb()
    const mongoUriFile = path.join(os.tmpdir(), "estetik-lab-e2e-mongo-uri.txt");
    await fs.writeFile(mongoUriFile, mongoServer.getUri());

    const uploadTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "estetik-lab-e2e-uploads-"));
    for (const sub of ["services", "packages", "categories", "posts", "testimonials", "experts", "site", "videos/thumbnails", "products"]) {
      await fs.ensureDir(path.join(uploadTempDir, "images", sub));
    }
    await fs.ensureDir(path.join(uploadTempDir, "videos", "thumbnails"));
    process.env.UPLOAD_PUBLIC_PATH = uploadTempDir;

    const { default: app } = await import("../../../src/app.js");
    // event listeners (see server.js's own imports) are registered as a side effect
    // of importing these files - eventEmitter.on(...) calls live at module top level,
    // not behind an init() call. app.js alone never imports them (production wires
    // them up separately in server.js), so without this, commission recording would
    // silently never fire on order:confirmed, with no error anywhere to point at why.
    // This exact gap exists in test-app.js too (supertest's HTTP integration tests
    // never exercise these listeners either) - not something E2E broke, just the
    // first place that needed the full event chain to actually run end-to-end.
    //
    // Only commission.listener.js is imported here, not email/telegram/google-calendar -
    // those integrations have no credentials in .env.test, and their actual
    // send/init behavior at import or event time hasn't been verified safe to run
    // unattended in this harness yet. Add them if/when a specific E2E spec needs to
    // assert on one of those side effects.
    await import("../../../src/events/listeners/commission.listener.js");

    await mongoose.connect(mongoServer.getUri());
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

    // roles are baseline data every E2E flow needs (registration/login assigns the
    // "user" role, admin login needs "admin" to exist) - seeded once here rather than
    // per-spec-file, same as ensureRole() does per-test in the HTTP integration suite,
    // just done once up front since E2E specs share this one server/database for the
    // whole run instead of getting a fresh one each test.
    await seedRoles();

    const server = app.listen(PORT, () => {
      logInfo(`[e2e] Server listening on port ${PORT}`);
      // Playwright's webServer option watches stdout for readiness when no `url`
      // health-check would otherwise suffice - this line is redundant with that but
      // makes the running process visibly confirm itself in `--headed`/local runs.
      console.log(`[e2e] ready on http://localhost:${PORT}`);
    });

    const shutdown = async (signal) => {
      logInfo(`[e2e] ${signal} received, shutting down`);
      server.close(async () => {
        try {
          await mongoose.connection.dropDatabase();
          await mongoose.connection.close();
          await mongoServer.stop();
          await fs.remove(uploadTempDir).catch(() => {});
          await fs.remove(mongoUriFile).catch(() => {});
        } finally {
          process.exit(0);
        }
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logError("[e2e] Failed to start E2E server", error);
    process.exit(1);
  }
}

start();