import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ical from "node-ical";
import externalBusyIntervalRepo from "../../../src/repositories/external-busy-interval.repository.js";
import { syncEmployeeFromIcs } from "../../../src/services/external-busy-interval.service.js";
import { id } from "../../helpers/factories.js";

function buildEmployee(overrides = {}) {
  return { _id: id(), sredimeIcsUrl: "https://sredime.example.com/feed.ics", ...overrides };
}

describe("external-busy-interval.service - syncEmployeeFromIcs", () => {
  it("does nothing (and never calls node-ical at all) when the employee has no configured feed URL", async (t) => {
    const fromURLMock = t.mock.method(ical.async, "fromURL", async () => ({}));

    const result = await syncEmployeeFromIcs(buildEmployee({ sredimeIcsUrl: null }));

    assert.deepEqual(result, { synced: 0, removed: 0 });
    assert.equal(fromURLMock.mock.calls.length, 0);
  });

  it("REGRESSION: passes an AbortSignal to node-ical's fromURL, so a slow/hanging feed can actually be aborted - not just caught if it happens to reject on its own", async (t) => {
    let capturedOptions;
    t.mock.method(ical.async, "fromURL", async (url, options) => {
      capturedOptions = options;
      return {};
    });
    t.mock.method(externalBusyIntervalRepo, "deleteStaleIntervals", async () => 0);

    await syncEmployeeFromIcs(buildEmployee());

    assert.ok(capturedOptions, "fromURL must be called with an options object");
    assert.ok(capturedOptions.signal instanceof AbortSignal, "fromURL must be called with an AbortSignal so it can be timed out");
    assert.equal(capturedOptions.signal.aborted, false, "the signal must not already be aborted at call time");
  });

  it("REGRESSION: a feed fetch that aborts/times out rejects normally for that one employee, instead of hanging - so jobs/sredime-jobs.js's per-employee try/catch can isolate it", async (t) => {
    t.mock.method(ical.async, "fromURL", async (url, options) => {
      // Simulates what a real timeout abort does to the underlying fetch: it
      // rejects with an AbortError rather than resolving or hanging forever.
      throw new DOMException("The operation was aborted.", "AbortError");
    });

    await assert.rejects(() => syncEmployeeFromIcs(buildEmployee()), (err) => err.name === "AbortError");
  });

  it("still parses and upserts VEVENT entries normally when the feed responds in time (fetch behavior for the happy path is unchanged)", async (t) => {
    const now = new Date();
    const future = new Date(now.getTime() + 3600000);
    t.mock.method(ical.async, "fromURL", async () => ({
      vtimezone1: { type: "VTIMEZONE" },
      event1: { type: "VEVENT", uid: "uid-1", start: future, end: new Date(future.getTime() + 1800000), summary: "Klijent" },
    }));
    const upsertMock = t.mock.method(externalBusyIntervalRepo, "upsertInterval", async () => ({}));
    t.mock.method(externalBusyIntervalRepo, "deleteStaleIntervals", async () => 0);

    const result = await syncEmployeeFromIcs(buildEmployee());

    assert.equal(result.synced, 1);
    assert.equal(upsertMock.mock.calls.length, 1);
    assert.equal(upsertMock.mock.calls[0].arguments[2], "uid-1");
  });
});
