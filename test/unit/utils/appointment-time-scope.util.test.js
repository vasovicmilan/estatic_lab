import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTimeScope, applyTimeScope } from "../../../src/utils/appointment-time-scope.util.js";

const NOW = new Date("2026-11-07T12:00:00Z"); // 13:00 in Belgrade (CET)
const START_TODAY = new Date("2026-11-06T23:00:00Z"); // 00:00 Belgrade on the 7th
const START_TOMORROW = new Date("2026-11-07T23:00:00Z");

describe("appointment-time-scope.util", () => {
  it("today = [start of today, start of tomorrow), soonest first", () => {
    const s = resolveTimeScope("today", NOW);
    assert.equal(s.dateFrom.getTime(), START_TODAY.getTime());
    assert.equal(s.dateTo.getTime(), START_TOMORROW.getTime());
    assert.deepEqual(s.sort, { startTime: 1, _id: 1 });
  });

  it("upcoming starts tomorrow, past ends before today (latest first)", () => {
    const up = resolveTimeScope("upcoming", NOW);
    assert.equal(up.dateFrom.getTime(), START_TOMORROW.getTime());
    assert.equal(up.dateTo, undefined);
    const past = resolveTimeScope("past", NOW);
    assert.equal(past.dateFrom, undefined);
    assert.equal(past.dateTo.getTime(), START_TODAY.getTime());
    assert.deepEqual(past.sort, { startTime: -1, _id: -1 });
  });

  it("unknown or empty scope means no restriction", () => {
    assert.equal(resolveTimeScope("", NOW), null);
    assert.equal(resolveTimeScope("everything", NOW), null);
    const out = applyTimeScope({ scope: "", dateFrom: undefined, dateTo: undefined, now: NOW });
    assert.deepEqual(out, { dateFrom: undefined, dateTo: undefined, sort: undefined });
  });

  it("intersects with explicit dates - the tighter bound wins", () => {
    const explicitFrom = new Date("2026-11-20T23:00:00Z");
    const out = applyTimeScope({ scope: "upcoming", dateFrom: explicitFrom, dateTo: new Date("2026-12-31T23:00:00Z"), now: NOW });
    assert.equal(out.dateFrom.getTime(), explicitFrom.getTime());
    assert.equal(out.dateTo.getTime(), new Date("2026-12-31T23:00:00Z").getTime());
    const past = applyTimeScope({ scope: "past", dateTo: new Date("2027-01-01T00:00:00Z"), now: NOW });
    assert.equal(past.dateTo.getTime(), START_TODAY.getTime());
  });
});
