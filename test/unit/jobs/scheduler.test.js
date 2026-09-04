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

    assert.equal(scheduleMock.mock.calls.length, 15);
  });

  it("registers every job on PM2 instance 0", async () => {
    process.env.NODE_APP_INSTANCE = "0";
    const startScheduler = await importFreshScheduler();

    startScheduler();

    assert.equal(scheduleMock.mock.calls.length, 15);
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

  it("REGRESSION: every date-sensitive job is registered as a wrapping closure, not passed directly - so node-cron's TaskContext argument can never reach the job's own `now` parameter", async () => {
    // node-cron v4's TaskFn is always invoked with a TaskContext object, never
    // with zero arguments/undefined (see node_modules/node-cron/dist/
    // node-cron.d.ts). Every job below has a `now = new Date()` default
    // parameter meant to only apply when called with no argument at all -
    // registering `runDailyBusinessReport` directly (instead of
    // `() => runDailyBusinessReport()`) would silently bind `now` to
    // node-cron's TaskContext object instead, and downstream date arithmetic
    // on that non-Date value is what produced "RangeError: Invalid time
    // value" in production. Verified here structurally (is the registered
    // function referentially distinct from the imported job function, i.e.
    // actually wrapped) rather than by invoking the real jobs, since their
    // runJob() wrapper swallows all internal errors - calling them for real
    // would pass this assertion either way and prove nothing.
    process.env.NODE_APP_INSTANCE = "0";
    const startScheduler = await importFreshScheduler();
    const reportJobsMod = await import("../../../src/jobs/report-jobs.js");
    const businessReportJobsMod = await import("../../../src/jobs/business-report-jobs.js");

    const dateSensitiveJobs = [
      reportJobsMod.runDailyLogReport,
      reportJobsMod.runWeeklyLogReport,
      reportJobsMod.runMonthlyLogReport,
      reportJobsMod.runYearlyLogReport,
      businessReportJobsMod.runDailyBusinessReport,
      businessReportJobsMod.runWeeklyBusinessReport,
      businessReportJobsMod.runMonthlyBusinessReport,
      businessReportJobsMod.runQuarterlyBusinessReport,
      businessReportJobsMod.runYearlyBusinessReport,
    ];

    startScheduler();

    const registeredFns = scheduleMock.mock.calls.map((call) => call.arguments[1]);
    for (const jobFn of dateSensitiveJobs) {
      assert.ok(registeredFns.includes(jobFn) === false, `${jobFn.name} must be registered as () => ${jobFn.name}(), not passed directly`);
    }
  });
});