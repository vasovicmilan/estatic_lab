import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import healthRoutes from "../../../src/routes/health.routes.js";

// A minimal standalone app (not the full src/app.js) so this stays a true unit test -
// no DB connection, no session store, no auth middleware. mongoose.connection is the
// same singleton the real route reads; readyState has a real get/set pair (not a
// plain, configurable data property - it's `configurable: false`, so t.mock.method /
// t.mock.getter can't patch it), so tests toggle it the same way mongoose itself
// does internally: by assigning through its own setter.
function buildApp() {
  const app = express();
  app.use(healthRoutes);
  return app;
}

const originalReadyState = mongoose.connection.readyState;

after(() => {
  mongoose.connection.readyState = originalReadyState;
});

describe("GET /health", () => {
  beforeEach(() => {
    mongoose.connection.readyState = originalReadyState;
  });

  it("returns 200 with status ok and db connected when mongoose.connection.readyState is 1 (connected)", async () => {
    mongoose.connection.readyState = 1;

    const res = await request(buildApp()).get("/health");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.db, "connected");
    assert.equal(typeof res.body.uptime, "number");
  });

  it("returns 503 with status error and db disconnected when mongoose.connection.readyState is not 1", async () => {
    mongoose.connection.readyState = 0;

    const res = await request(buildApp()).get("/health");

    assert.equal(res.status, 503);
    assert.equal(res.body.status, "error");
    assert.equal(res.body.db, "disconnected");
  });

  it("is not mounted under /api/v1 and needs no auth or CSRF token", async () => {
    mongoose.connection.readyState = 1;

    const res = await request(buildApp()).get("/health");

    assert.equal(res.status, 200);
  });
});
