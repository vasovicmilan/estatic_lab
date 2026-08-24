import { describe, it } from "node:test";
import assert from "node:assert/strict";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";
import { loadRuntimeSettings, getBookingPolicy, getCurrency } from "../../../src/config/runtime-settings.cache.js";

describe("runtime-settings.cache", () => {
  describe("loadRuntimeSettings", () => {
    it("populates the cache from the stored SiteSettings document", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {
          bufferMinutes: 45,
          slotGridMinutes: 15,
          userCancellationCutoffHours: 48,
          rescheduleCutoffHours: 12,
          rescheduleSameDayFloorHours: 2,
          rescheduleMinLeadMinutes: 20,
        },
        currency: { code: "EUR", symbol: "€", symbolPosition: "before" },
      }));

      await loadRuntimeSettings();

      assert.equal(getBookingPolicy().bufferMinutes, 45);
      assert.equal(getBookingPolicy().userCancellationCutoffHours, 48);
      assert.deepEqual(getCurrency(), { code: "EUR", symbol: "€", symbolPosition: "before" });
    });

    it("keeps the previous values instead of crashing when the DB read fails", async (t) => {
      // establish a known-good value first
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: { bufferMinutes: 99 },
        currency: { code: "USD" },
      }));
      await loadRuntimeSettings();
      assert.equal(getBookingPolicy().bufferMinutes, 99);

      // now simulate a failure - the cache should NOT be wiped or crash the caller
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => {
        throw new Error("DB unreachable");
      });

      await assert.doesNotReject(() => loadRuntimeSettings());
      assert.equal(getBookingPolicy().bufferMinutes, 99); // unchanged, not reset to defaults
    });

    it("falls back field-by-field to the previous cached value for anything missing on the document", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: { bufferMinutes: 60 }, // only one field present
        currency: {},
      }));

      await loadRuntimeSettings();

      const policy = getBookingPolicy();
      assert.equal(policy.bufferMinutes, 60);
      // every other field should still be a real number (fallen back, not undefined/NaN)
      assert.equal(typeof policy.slotGridMinutes, "number");
      assert.equal(typeof policy.userCancellationCutoffHours, "number");
    });
  });
});