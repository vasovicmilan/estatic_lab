import { describe, it } from "node:test";
import assert from "node:assert/strict";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";
import {
  loadRuntimeSettings,
  getBookingPolicy,
  getCurrency,
  getCommissionPolicy,
  getWorkingHours,
  hasFixedWorkingHours,
  isDateClosed,
} from "../../../src/config/runtime-settings.cache.js";

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
        commissionPolicy: { minimumSessionCommission: 800 },
      }));

      await loadRuntimeSettings();

      assert.equal(getBookingPolicy().bufferMinutes, 45);
      assert.equal(getBookingPolicy().userCancellationCutoffHours, 48);
      assert.deepEqual(getCurrency(), { code: "EUR", symbol: "€", symbolPosition: "before" });
      assert.equal(getCommissionPolicy().minimumSessionCommission, 800);
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

    it("falls back to the previous cached minimumSessionCommission when commissionPolicy is missing entirely from the document", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: { bufferMinutes: 30 },
        currency: {},
        commissionPolicy: { minimumSessionCommission: 900 },
      }));
      await loadRuntimeSettings();
      assert.equal(getCommissionPolicy().minimumSessionCommission, 900);

      // now a document with no commissionPolicy field at all
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: { bufferMinutes: 30 },
        currency: {},
      }));
      await loadRuntimeSettings();

      assert.equal(getCommissionPolicy().minimumSessionCommission, 900, "must keep the previous value, not silently reset to the hardcoded default");
    });

    it("loads workingHours/closedDates from the document, defaulting missing pieces sanely", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {},
        currency: {},
        workingHours: [{ day: "monday", isOpen: true, from: "09:00", to: "18:00" }],
        closedDates: [{ date: new Date("2026-01-01T00:00:00.000Z"), reason: "Nova godina", recurringYearly: true }],
      }));

      await loadRuntimeSettings();

      assert.deepEqual(getWorkingHours(), [{ day: "monday", isOpen: true, from: "09:00", to: "18:00" }]);
      assert.equal(getWorkingHours().some((wh) => wh.isOpen), true);
      assert.equal(hasFixedWorkingHours(), true);
    });
  });

  describe("hasFixedWorkingHours", () => {
    it("is false (unconfigured) when every day defaults to isOpen: false", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {},
        currency: {},
        workingHours: [
          { day: "monday", isOpen: false, from: "09:00", to: "20:00" },
          { day: "tuesday", isOpen: false, from: "09:00", to: "20:00" },
        ],
        closedDates: [],
      }));

      await loadRuntimeSettings();

      assert.equal(hasFixedWorkingHours(), false);
    });
  });

  describe("isDateClosed", () => {
    it("matches a non-recurring closed date only on the exact calendar day", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {},
        currency: {},
        workingHours: [],
        closedDates: [{ date: new Date("2026-12-24T00:00:00.000Z"), reason: "Vanredni odmor", recurringYearly: false }],
      }));

      await loadRuntimeSettings();

      assert.equal(isDateClosed(new Date("2026-12-24T10:00:00.000Z")), true);
      assert.equal(isDateClosed(new Date("2027-12-24T10:00:00.000Z")), false, "a non-recurring date must not match a different year");
      assert.equal(isDateClosed(new Date("2026-12-25T10:00:00.000Z")), false);
    });

    it("matches a recurringYearly closed date on the same month/day regardless of the stored year", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {},
        currency: {},
        workingHours: [],
        closedDates: [{ date: new Date("2020-01-01T00:00:00.000Z"), reason: "Nova godina", recurringYearly: true }],
      }));

      await loadRuntimeSettings();

      assert.equal(isDateClosed(new Date("2026-01-01T10:00:00.000Z")), true);
      assert.equal(isDateClosed(new Date("2099-01-01T10:00:00.000Z")), true);
      assert.equal(isDateClosed(new Date("2026-01-02T10:00:00.000Z")), false);
    });

    it("returns false when no closed dates are configured", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
        bookingPolicy: {},
        currency: {},
        workingHours: [],
        closedDates: [],
      }));

      await loadRuntimeSettings();

      assert.equal(isDateClosed(new Date()), false);
    });
  });
});