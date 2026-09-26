import { describe, it } from "node:test";
import assert from "node:assert/strict";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";
import runtimeSettingsCache from "../../../src/config/runtime-settings.cache.js";
import fileCleanupUtil from "../../../src/utils/file-cleanup.util.js";
import * as siteSettingsService from "../../../src/services/site-settings.service.js";

function buildSettingsDoc(overrides = {}) {
  return {
    hero: { image: null, imageAlt: "" },
    bookingPolicy: {
      bufferMinutes: 30,
      slotGridMinutes: 30,
      userCancellationCutoffHours: 24,
      rescheduleCutoffHours: 24,
      rescheduleSameDayFloorHours: 4,
      rescheduleMinLeadMinutes: 30,
    },
    currency: { code: "RSD", symbol: "RSD", symbolPosition: "after" },
    commissionPolicy: { minimumSessionCommission: 500 },
    workingHours: [
      { day: "monday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "tuesday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "wednesday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "thursday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "friday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "saturday", isOpen: false, from: "09:00", to: "20:00" },
      { day: "sunday", isOpen: false, from: "09:00", to: "20:00" },
    ],
    closedDates: [],
    ...overrides,
  };
}

const FULL_WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function buildFullWeek(overridesByDay = {}) {
  return FULL_WEEK_DAYS.map((day) => ({ day, isOpen: true, from: "09:00", to: "20:00", ...overridesByDay[day] }));
}

describe("site-settings.service", () => {
  describe("updatePolicy", () => {
    it("REGRESSION: rejects a non-numeric or missing booking policy field with a clean 400, not an uncaught error", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());

      await assert.rejects(
        () =>
          siteSettingsService.updatePolicy({
            bookingPolicy: {
              bufferMinutes: NaN,
              slotGridMinutes: 30,
              userCancellationCutoffHours: 24,
              rescheduleCutoffHours: 24,
              rescheduleSameDayFloorHours: 4,
              rescheduleMinLeadMinutes: 30,
            },
          }),
        (err) => err.statusCode === 400
      );
    });

    it("REGRESSION: rejects a negative booking policy field", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());

      await assert.rejects(
        () =>
          siteSettingsService.updatePolicy({
            bookingPolicy: {
              bufferMinutes: -5,
              slotGridMinutes: 30,
              userCancellationCutoffHours: 24,
              rescheduleCutoffHours: 24,
              rescheduleSameDayFloorHours: 4,
              rescheduleMinLeadMinutes: 30,
            },
          }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a reschedule same-day floor that isn't strictly below the free-reschedule cutoff", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());

      await assert.rejects(
        () =>
          siteSettingsService.updatePolicy({
            bookingPolicy: {
              bufferMinutes: 30,
              slotGridMinutes: 30,
              userCancellationCutoffHours: 24,
              rescheduleCutoffHours: 12,
              rescheduleSameDayFloorHours: 12, // equal, not strictly less - should be rejected
              rescheduleMinLeadMinutes: 30,
            },
          }),
        (err) => err.statusCode === 400
      );
    });

    it("saves booking policy and immediately refreshes the runtime cache so the change is live without a restart", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      const refreshMock = t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      const newPolicy = {
        bufferMinutes: 45,
        slotGridMinutes: 15,
        userCancellationCutoffHours: 48,
        rescheduleCutoffHours: 24,
        rescheduleSameDayFloorHours: 4,
        rescheduleMinLeadMinutes: 30,
      };

      await siteSettingsService.updatePolicy({ bookingPolicy: newPolicy });

      assert.equal(updateMock.mock.calls.length, 1);
      assert.deepEqual(updateMock.mock.calls[0].arguments[0].bookingPolicy, newPolicy);
      assert.equal(refreshMock.mock.calls.length, 1);
    });

    it("saves currency independently of booking policy - either can be updated alone", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      await siteSettingsService.updatePolicy({ currency: { code: "EUR", symbol: "€", symbolPosition: "before" } });

      const savedData = updateMock.mock.calls[0].arguments[0];
      assert.deepEqual(savedData.currency, { code: "EUR", symbol: "€", symbolPosition: "before" });
      assert.equal("bookingPolicy" in savedData, false);
    });

    it("rejects a non-numeric or negative minimumSessionCommission with a clean 400", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());

      await assert.rejects(
        () => siteSettingsService.updatePolicy({ commissionPolicy: { minimumSessionCommission: NaN } }),
        (err) => err.statusCode === 400
      );
      await assert.rejects(
        () => siteSettingsService.updatePolicy({ commissionPolicy: { minimumSessionCommission: -100 } }),
        (err) => err.statusCode === 400
      );
    });

    it("saves the commission policy independently and refreshes the runtime cache, same as booking policy/currency", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      const refreshMock = t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      await siteSettingsService.updatePolicy({ commissionPolicy: { minimumSessionCommission: 750 } });

      const savedData = updateMock.mock.calls[0].arguments[0];
      assert.deepEqual(savedData.commissionPolicy, { minimumSessionCommission: 750 });
      assert.equal("bookingPolicy" in savedData, false, "updating commission policy alone must not touch booking policy");
      assert.equal(refreshMock.mock.calls.length, 1);
    });
  });

  describe("getSiteSettingsForEdit", () => {
    it("returns all four sections - hero, bookingPolicy, currency, commissionPolicy - from the one stored document", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () =>
        buildSettingsDoc({ hero: { image: "/images/site/x-medium.webp", imageAlt: "Salon" } })
      );

      const result = await siteSettingsService.getSiteSettingsForEdit();

      assert.equal(result.hero.image, "/images/site/x-medium.webp");
      assert.equal(result.bookingPolicy.bufferMinutes, 30);
      assert.equal(result.currency.code, "RSD");
      // REGRESSION: this function used to omit commissionPolicy from its
      // returned shape entirely, even though the model/repo/controller all
      // knew about it - existing.commissionPolicy.minimumSessionCommission
      // in the admin controller then threw on undefined, 500ing the whole
      // site-settings form (both plain saves and hero-image uploads, since
      // they share this same read) rather than the clean update this was
      // meant to be.
      assert.equal(result.commissionPolicy.minimumSessionCommission, 500);
    });
  });

  describe("getHeroContent", () => {
    it("derives thumb/original srcset variants alongside the stored medium image when all three files exist on disk", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () =>
        buildSettingsDoc({ hero: { image: "/images/site/hero-42-medium.webp", imageAlt: "Salon" } })
      );
      t.mock.method(fileCleanupUtil, "imageFileExists", () => true);

      const result = await siteSettingsService.getHeroContent();

      assert.equal(result.image, "/images/site/hero-42-medium.webp");
      assert.deepEqual(result.imageVariants, {
        thumb: "/images/site/hero-42-thumb.webp",
        medium: "/images/site/hero-42-medium.webp",
        original: "/images/site/hero-42-original.webp",
      });
    });

    it("REGRESSION: nulls out a variant that doesn't actually exist on disk, instead of handing the template a 404 srcset candidate", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () =>
        buildSettingsDoc({ hero: { image: "/images/site/hero-42-medium.webp", imageAlt: "Salon" } })
      );
      // simulates DEFAULT_HERO_IMAGE / a manually-placed file that only has the
      // medium variant, not the multer-generated thumb/original siblings
      t.mock.method(fileCleanupUtil, "imageFileExists", (url) => url.endsWith("-medium.webp"));

      const result = await siteSettingsService.getHeroContent();

      assert.deepEqual(result.imageVariants, {
        thumb: null,
        medium: "/images/site/hero-42-medium.webp",
        original: null,
      });
    });

    it("falls back to the hardcoded default image when no admin has uploaded one", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc({ hero: { image: null, imageAlt: "" } }));
      t.mock.method(fileCleanupUtil, "imageFileExists", (url) => url === "/images/site/hero-medium.webp");

      const result = await siteSettingsService.getHeroContent();

      assert.equal(result.image, "/images/site/hero-medium.webp");
      assert.deepEqual(result.imageVariants, { thumb: null, medium: "/images/site/hero-medium.webp", original: null });
    });
  });

  describe("updateWorkingHours", () => {
    it("rejects a payload that doesn't have exactly 7 days", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      await assert.rejects(
        () => siteSettingsService.updateWorkingHours(buildFullWeek().slice(0, 6)),
        (err) => err.statusCode === 400
      );
    });

    it("rejects an invalid or duplicated day", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const withBadDay = buildFullWeek();
      withBadDay[0] = { ...withBadDay[0], day: "funday" };
      await assert.rejects(() => siteSettingsService.updateWorkingHours(withBadDay), (err) => err.statusCode === 400);

      const withDuplicateDay = buildFullWeek();
      withDuplicateDay[1] = { ...withDuplicateDay[1], day: withDuplicateDay[0].day };
      await assert.rejects(() => siteSettingsService.updateWorkingHours(withDuplicateDay), (err) => err.statusCode === 400);
    });

    it("rejects a malformed time string or from >= to on an open day", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());

      const badFormat = buildFullWeek({ monday: { from: "9am" } });
      await assert.rejects(() => siteSettingsService.updateWorkingHours(badFormat), (err) => err.statusCode === 400);

      const badOrder = buildFullWeek({ monday: { from: "20:00", to: "09:00" } });
      await assert.rejects(() => siteSettingsService.updateWorkingHours(badOrder), (err) => err.statusCode === 400);
    });

    it("does not validate from/to on a day marked isOpen: false, since it's just leftover display data", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      const week = buildFullWeek();
      week[6] = { day: "sunday", isOpen: false, from: "garbage", to: "also garbage" };

      await siteSettingsService.updateWorkingHours(week);

      assert.equal(updateMock.mock.calls.length, 1);
    });

    it("saves a valid 7-day schedule and refreshes the runtime cache immediately", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      const refreshMock = t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      const week = buildFullWeek({ sunday: { isOpen: false } });
      await siteSettingsService.updateWorkingHours(week);

      const saved = updateMock.mock.calls[0].arguments[0].workingHours;
      assert.equal(saved.length, 7);
      assert.equal(saved.find((d) => d.day === "sunday").isOpen, false);
      assert.equal(refreshMock.mock.calls.length, 1);
    });
  });

  describe("updateClosedDates", () => {
    it("rejects a non-array payload", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      await assert.rejects(() => siteSettingsService.updateClosedDates("not-an-array"), (err) => err.statusCode === 400);
    });

    it("rejects an entry with an unparseable date", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      await assert.rejects(
        () => siteSettingsService.updateClosedDates([{ date: "not-a-date" }]),
        (err) => err.statusCode === 400
      );
    });

    it("normalizes reason/recurringYearly and saves, refreshing the runtime cache", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => buildSettingsDoc());
      const updateMock = t.mock.method(siteSettingsRepo, "updateSiteSettings", async () => {});
      const refreshMock = t.mock.method(runtimeSettingsCache, "loadRuntimeSettings", async () => {});

      await siteSettingsService.updateClosedDates([
        { date: "2026-01-01", reason: "  Nova godina  ", recurringYearly: true },
        { date: "2026-05-01" }, // no reason/recurringYearly given
      ]);

      const saved = updateMock.mock.calls[0].arguments[0].closedDates;
      assert.equal(saved.length, 2);
      assert.equal(saved[0].reason, "Nova godina");
      assert.equal(saved[0].recurringYearly, true);
      assert.equal(saved[1].reason, "");
      assert.equal(saved[1].recurringYearly, false);
      assert.equal(refreshMock.mock.calls.length, 1);
    });
  });
});