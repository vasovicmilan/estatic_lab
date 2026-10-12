import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getZonedDateKey, resolveBookingDate, getStartOfDayInZone } from "../../../src/utils/date.time.util.js";

describe("booking date helpers (Belgrade day, not server/UTC day)", () => {
  it("getZonedDateKey returns the Belgrade date when UTC is still on the previous day", () => {
    // 00:54 CEST on 2 Oct == 22:54 UTC on 1 Oct
    assert.equal(getZonedDateKey(new Date("2026-10-01T22:54:00Z")), "2026-10-02");
  });

  it("getZonedDateKey handles winter time (CET, UTC+1)", () => {
    assert.equal(getZonedDateKey(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
    assert.equal(getZonedDateKey(new Date("2026-01-15T22:30:00Z")), "2026-01-15");
  });

  it("resolveBookingDate maps YYYY-MM-DD to a moment inside that Belgrade day", () => {
    const d = resolveBookingDate("2026-10-02");
    assert.equal(getZonedDateKey(d), "2026-10-02");
    assert.equal(getStartOfDayInZone(d).toISOString(), "2026-10-01T22:00:00.000Z");
  });

  it("resolveBookingDate: empty -> now, garbage -> Invalid Date", () => {
    assert.ok(Math.abs(resolveBookingDate("").getTime() - Date.now()) < 5000);
    assert.ok(Number.isNaN(resolveBookingDate("not-a-date").getTime()));
  });
});
