import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";
import { loadRuntimeSettings } from "../../../src/config/runtime-settings.cache.js";
import {
  canUserCancelAppointment,
  getRescheduleWindow,
  hasMinimumRescheduleLeadTime,
} from "../../../src/utils/appointment-cancellation.util.js";

const DEFAULT_POLICY = {
  bufferMinutes: 30,
  slotGridMinutes: 30,
  userCancellationCutoffHours: 24,
  rescheduleCutoffHours: 24,
  rescheduleSameDayFloorHours: 4,
  rescheduleMinLeadMinutes: 30,
};

async function setPolicy(overrides) {
  const original = siteSettingsRepo.findOrCreateSiteSettings;
  siteSettingsRepo.findOrCreateSiteSettings = async () => ({
    bookingPolicy: { ...DEFAULT_POLICY, ...overrides },
    currency: { code: "RSD", symbol: "RSD", symbolPosition: "after" },
  });
  await loadRuntimeSettings();
  siteSettingsRepo.findOrCreateSiteSettings = original;
}

describe("appointment-cancellation.util", () => {
  after(async () => {
    // leave the shared cache back at defaults for any other test file that
    // runs after this one in the same process
    await setPolicy({});
  });

  describe("canUserCancelAppointment", () => {
    it("allows cancelling when comfortably past the configured cutoff", async () => {
      await setPolicy({ userCancellationCutoffHours: 24 });
      const start = new Date(Date.now() + 48 * 3600000);
      assert.equal(canUserCancelAppointment("confirmed", start), true);
    });

    it("blocks cancelling once inside the configured cutoff", async () => {
      await setPolicy({ userCancellationCutoffHours: 24 });
      const start = new Date(Date.now() + 2 * 3600000);
      assert.equal(canUserCancelAppointment("confirmed", start), false);
    });

    it("REGRESSION: reflects an admin policy change immediately, without a process restart", async () => {
      // A termin 10h out: not cancellable under the default 24h cutoff...
      const start = new Date(Date.now() + 10 * 3600000);
      await setPolicy({ userCancellationCutoffHours: 24 });
      assert.equal(canUserCancelAppointment("confirmed", start), false);

      // ...but IS cancellable the instant an admin lowers the cutoff to 8h -
      // no re-import, no restart. This is the entire point of moving off the
      // old frozen `const USER_CANCELLATION_CUTOFF_HOURS` module constant.
      await setPolicy({ userCancellationCutoffHours: 8 });
      assert.equal(canUserCancelAppointment("confirmed", start), true);
    });

    it("never allows cancelling a status that isn't pending/confirmed, regardless of policy", async () => {
      await setPolicy({ userCancellationCutoffHours: 0 });
      const start = new Date(Date.now() + 999 * 3600000);
      assert.equal(canUserCancelAppointment("completed", start), false);
    });
  });

  describe("getRescheduleWindow", () => {
    it("returns any_day, same_day_only, or forbidden according to the configured tiers", async () => {
      await setPolicy({ rescheduleCutoffHours: 24, rescheduleSameDayFloorHours: 4 });

      assert.equal(getRescheduleWindow("confirmed", new Date(Date.now() + 48 * 3600000)), "any_day");
      assert.equal(getRescheduleWindow("confirmed", new Date(Date.now() + 10 * 3600000)), "same_day_only");
      assert.equal(getRescheduleWindow("confirmed", new Date(Date.now() + 1 * 3600000)), "forbidden");
    });

    it("REGRESSION: widening the same-day floor at runtime immediately reclassifies a borderline appointment", async () => {
      const start = new Date(Date.now() + 6 * 3600000);

      await setPolicy({ rescheduleCutoffHours: 24, rescheduleSameDayFloorHours: 4 });
      assert.equal(getRescheduleWindow("confirmed", start), "same_day_only");

      await setPolicy({ rescheduleCutoffHours: 24, rescheduleSameDayFloorHours: 8 });
      assert.equal(getRescheduleWindow("confirmed", start), "forbidden");
    });
  });

  describe("hasMinimumRescheduleLeadTime", () => {
    it("enforces the configured minimum lead time on the NEW proposed time", async () => {
      await setPolicy({ rescheduleMinLeadMinutes: 30 });
      assert.equal(hasMinimumRescheduleLeadTime(new Date(Date.now() + 45 * 60000)), true);
      assert.equal(hasMinimumRescheduleLeadTime(new Date(Date.now() + 10 * 60000)), false);
    });
  });
});