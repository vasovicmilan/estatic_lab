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
    ...overrides,
  };
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
  });

  describe("getSiteSettingsForEdit", () => {
    it("returns all three sections - hero, bookingPolicy, currency - from the one stored document", async (t) => {
      t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () =>
        buildSettingsDoc({ hero: { image: "/images/site/x-medium.webp", imageAlt: "Salon" } })
      );

      const result = await siteSettingsService.getSiteSettingsForEdit();

      assert.equal(result.hero.image, "/images/site/x-medium.webp");
      assert.equal(result.bookingPolicy.bufferMinutes, 30);
      assert.equal(result.currency.code, "RSD");
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
});