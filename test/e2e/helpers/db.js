import mongoose from "mongoose";
import fs from "fs-extra";
import path from "path";
import os from "os";

export const MONGO_URI_FILE = path.join(os.tmpdir(), "estetik-lab-e2e-mongo-uri.txt");

/**
 * E2E spec files run in a separate Node process from the one Playwright's
 * `webServer` spawns (test/e2e/setup/start-server.js) - they don't inherit that
 * process's env vars, so `process.env.MONGO_URI` isn't visible here directly.
 * start-server.js writes the connection string to a well-known temp file once its
 * MongoMemoryReplSet is up; this reads it back so spec files can open their own
 * connection to the exact same in-memory database for direct setup/assertions
 * (seeding a product, promoting a user to admin, reading a confirmation token) that
 * driving everything through the browser alone can't do.
 */
export async function connectDb() {
  if (mongoose.connection.readyState === 1) return;

  // start-server.js's webServer readiness check only guarantees the HTTP port is
  // listening, which happens after the URI file is written - but a few retries here
  // is cheap insurance against a race on a slow first boot.
  let uri;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await fs.pathExists(MONGO_URI_FILE)) {
      uri = (await fs.readFile(MONGO_URI_FILE, "utf-8")).trim();
      if (uri) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!uri) throw new Error(`E2E Mongo URI file not found at ${MONGO_URI_FILE} - is the Playwright webServer running?`);

  await mongoose.connect(uri);
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
}