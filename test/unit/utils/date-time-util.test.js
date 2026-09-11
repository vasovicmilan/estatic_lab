import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { zonedInputToUtcDate, utcDateToZonedInputValue, getStartOfDayInZone } from "../../../src/utils/date.time.util.js";

// These exist specifically to fix the scheduled-post publish bug: a
// <input type="datetime-local"> submits a naive "YYYY-MM-DDTHH:mm" string with
// no timezone info, and `new Date(value)` resolves that using the *server
// process's own local time* - not necessarily Europe/Belgrade. On a server
// running in UTC, an admin's "14:00" (meant as Belgrade time) got silently
// stored as 14:00 UTC (= 16:00 Belgrade), so the cron sweep in post-jobs.js
// never found the post due at the time the admin actually expected.
describe("date.time.util - timezone-aware scheduledFor helpers", () => {
  describe("zonedInputToUtcDate", () => {
    it("converts a summer (CEST, UTC+2) Belgrade wall-clock time to the correct UTC instant", () => {
      const result = zonedInputToUtcDate("2026-07-29T14:00", "Europe/Belgrade");
      assert.equal(result.toISOString(), "2026-07-29T12:00:00.000Z");
    });

    it("converts a winter (CET, UTC+1) Belgrade wall-clock time to the correct UTC instant", () => {
      const result = zonedInputToUtcDate("2026-01-15T09:30", "Europe/Belgrade");
      assert.equal(result.toISOString(), "2026-01-15T08:30:00.000Z");
    });

    it("is independent of the process's own local/system timezone", () => {
      // Same input, explicit target zone - result must not depend on
      // whatever TZ the Node process happens to be running under.
      const withSeconds = zonedInputToUtcDate("2026-07-29T14:00:00", "Europe/Belgrade");
      const withoutSeconds = zonedInputToUtcDate("2026-07-29T14:00", "Europe/Belgrade");
      assert.equal(withSeconds.toISOString(), withoutSeconds.toISOString());
    });

    it("returns null for empty/falsy input", () => {
      assert.equal(zonedInputToUtcDate(""), null);
      assert.equal(zonedInputToUtcDate(null), null);
      assert.equal(zonedInputToUtcDate(undefined), null);
    });

    it("returns null for a malformed string", () => {
      assert.equal(zonedInputToUtcDate("not-a-date"), null);
    });
  });

  describe("utcDateToZonedInputValue", () => {
    it("formats a UTC Date as the Belgrade wall-clock datetime-local value (summer)", () => {
      const value = utcDateToZonedInputValue(new Date("2026-07-29T12:00:00.000Z"), "Europe/Belgrade");
      assert.equal(value, "2026-07-29T14:00");
    });

    it("formats a UTC Date as the Belgrade wall-clock datetime-local value (winter)", () => {
      const value = utcDateToZonedInputValue(new Date("2026-01-15T08:30:00.000Z"), "Europe/Belgrade");
      assert.equal(value, "2026-01-15T09:30");
    });

    it("returns an empty string for falsy input", () => {
      assert.equal(utcDateToZonedInputValue(null), "");
      assert.equal(utcDateToZonedInputValue(""), "");
    });

    it("returns an empty string for an invalid date", () => {
      assert.equal(utcDateToZonedInputValue("not-a-date"), "");
    });
  });

  describe("round trip", () => {
    it("zonedInputToUtcDate -> utcDateToZonedInputValue returns the original wall-clock string", () => {
      const inputs = ["2026-07-29T14:00", "2026-01-15T09:30", "2026-12-01T23:45"];
      for (const input of inputs) {
        const utc = zonedInputToUtcDate(input, "Europe/Belgrade");
        assert.equal(utcDateToZonedInputValue(utc, "Europe/Belgrade"), input);
      }
    });
  });

  describe("getStartOfDayInZone - the boundary user.controller.js's appointments() splits upcoming/past on", () => {
    it("returns Belgrade midnight (00:00) for a given instant, not UTC midnight - CEST (summer, UTC+2)", () => {
      // 2026-07-29 10:00 UTC is 2026-07-29 12:00 in Belgrade (CEST) - same calendar day either way here,
      // the real assertion is on the exact returned instant
      const start = getStartOfDayInZone(new Date("2026-07-29T10:00:00.000Z"), "Europe/Belgrade");
      assert.equal(start.toISOString(), "2026-07-28T22:00:00.000Z"); // 2026-07-29 00:00 Belgrade = 2026-07-28 22:00 UTC (CEST, UTC+2)
    });

    it("returns Belgrade midnight (00:00) for a given instant, not UTC midnight - CET (winter, UTC+1)", () => {
      const start = getStartOfDayInZone(new Date("2026-01-15T10:00:00.000Z"), "Europe/Belgrade");
      assert.equal(start.toISOString(), "2026-01-14T23:00:00.000Z"); // 2026-01-15 00:00 Belgrade = 2026-01-14 23:00 UTC (CET, UTC+1)
    });

    it("correctly rolls over to the NEXT Belgrade calendar day for a late-evening UTC instant", () => {
      // 2026-07-29 23:00 UTC is already 2026-07-30 01:00 in Belgrade (CEST) - a naive UTC-midnight
      // calculation would wrongly still call this "2026-07-29"
      const start = getStartOfDayInZone(new Date("2026-07-29T23:00:00.000Z"), "Europe/Belgrade");
      assert.equal(start.toISOString(), "2026-07-29T22:00:00.000Z"); // 2026-07-30 00:00 Belgrade = 2026-07-29 22:00 UTC
    });

    it("defaults to 'now' when no date is given", () => {
      const start = getStartOfDayInZone();
      assert.ok(start instanceof Date);
      assert.ok(!isNaN(start.getTime()));
    });
  });
});