import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import cron from "node-cron";

async function importFreshScheduler() {
  const mod = await import(`../../../src/jobs/scheduler.js?t=${Date.now()}-${Math.random()}`);
  return mod.startScheduler;
}

describe("scheduler", () => {
  let originalInstanceId;
  let scheduleMock;

  beforeEach((t) => {
    originalInstanceId = process.env.NODE_APP_INSTANCE;
    scheduleMock = t.mock.method(cron, "schedule", () => ({}));
  });

  afterEach(() => {
    if (originalInstanceId === undefined) delete process.env.NODE_APP_INSTANCE;
    else process.env.NODE_APP_INSTANCE = originalInstanceId;
  });

  it("registers every scheduled job when NODE_APP_INSTANCE is unset (single-instance, non-PM2 deployment)", async () => {
    delete process.env.NODE_APP_INSTANCE;
    const startScheduler = await importFreshScheduler();

    startScheduler();

    assert.equal(scheduleMock.mock.calls.length, 14);
  });

  it("registers every job on PM2 instance 0", async () => {
    process.env.NODE_APP_INSTANCE = "0";
    const startScheduler = await importFreshScheduler();

    startScheduler();

    assert.equal(scheduleMock.mock.calls.length, 14);
  });

  it("REGRESSION: registers NOTHING on any other PM2 cluster worker", async () => {
    process.env.NODE_APP_INSTANCE = "1";
    const startScheduler = await importFreshScheduler();

    startScheduler();

    assert.equal(scheduleMock.mock.calls.length, 0);
  });

  it("also skips on instance 2, 3, etc - not just instance 1", async () => {
    process.env.NODE_APP_INSTANCE = "3";
    const startScheduler = await importFreshScheduler();

    startScheduler();

    assert.equal(scheduleMock.mock.calls.length, 0);
  });

  it("passes the configured timezone to every registered job", async () => {
    process.env.NODE_APP_INSTANCE = "0";
    process.env.CRON_TIMEZONE = "Europe/Belgrade";
    const startScheduler = await importFreshScheduler();

    startScheduler();

    for (const call of scheduleMock.mock.calls) {
      const options = call.arguments[2];
      assert.equal(options.timezone, "Europe/Belgrade");
    }
  });
});
