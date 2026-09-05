import siteSettingsRepo from "../repositories/site-settings.repository.js";
import runtimeSettingsCache from "../config/runtime-settings.cache.js";
import { badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { getVerifiedResponsiveImageUrls } from "../utils/image-format.util.js";

// Falls back to the original hardcoded hero image if an admin hasn't uploaded
// one yet - so a brand-new deployment (or one where the settings document
// somehow ended up with hero.image = null) never renders a broken <img>.
const DEFAULT_HERO_IMAGE = "/images/site/hero-medium.webp";

/**
 * Public-facing read - used by index.presenter.js to build the homepage hero
 * section. Returns plain data, not a mongoose document, and always returns a
 * usable image (see DEFAULT_HERO_IMAGE above) so the presenter never has to
 * know or care whether an admin has customized it yet.
 *
 * Also derives thumb/original sibling URLs from the stored medium URL via
 * getVerifiedResponsiveImageUrls (image-format.util.js) so the homepage <img>
 * can use a srcset instead of always shipping the 800px-wide variant to
 * phones. Uses the fs-VERIFIED variant (not the plain formatImage() shape
 * every other mapper uses) specifically because DEFAULT_HERO_IMAGE is a
 * manually-placed file, not something multer generated - it isn't guaranteed
 * to have -thumb/-original siblings on disk the way an admin upload is, so a
 * missing variant needs to come back null here rather than becoming a broken
 * <img> candidate in landing/home.ejs.
 */
export async function getHeroContent() {
  const settings = await siteSettingsRepo.findOrCreateSiteSettings();
  const image = settings.hero?.image || DEFAULT_HERO_IMAGE;
  return {
    image,
    imageAlt: settings.hero?.imageAlt || "",
    imageVariants: getVerifiedResponsiveImageUrls(image),
  };
}

/**
 * Admin-facing read - same underlying document as getHeroContent, but returns
 * the raw stored value (no DEFAULT_HERO_IMAGE fallback) so the edit form can
 * correctly show an empty image field when nothing's been uploaded yet,
 * rather than presenting the fallback as if an admin had chosen it.
 */
export async function getSiteSettingsForEdit() {
  const settings = await siteSettingsRepo.findOrCreateSiteSettings();
  return {
    hero: {
      image: settings.hero?.image || null,
      imageAlt: settings.hero?.imageAlt || "",
    },
    bookingPolicy: {
      bufferMinutes: settings.bookingPolicy?.bufferMinutes,
      slotGridMinutes: settings.bookingPolicy?.slotGridMinutes,
      userCancellationCutoffHours: settings.bookingPolicy?.userCancellationCutoffHours,
      rescheduleCutoffHours: settings.bookingPolicy?.rescheduleCutoffHours,
      rescheduleSameDayFloorHours: settings.bookingPolicy?.rescheduleSameDayFloorHours,
      rescheduleMinLeadMinutes: settings.bookingPolicy?.rescheduleMinLeadMinutes,
    },
    currency: {
      code: settings.currency?.code,
      symbol: settings.currency?.symbol,
      symbolPosition: settings.currency?.symbolPosition,
    },
  };
}

export async function updateHero({ image, imageAlt }) {
  const existing = await siteSettingsRepo.findOrCreateSiteSettings();
  await siteSettingsRepo.updateSiteSettings({
    hero: {
      // a new upload always wins; omitting `image` (no new file chosen) keeps
      // whatever was already stored instead of wiping it back to null
      image: image !== undefined ? image : existing.hero?.image || null,
      imageAlt: imageAlt !== undefined ? imageAlt : existing.hero?.imageAlt || "",
    },
  });
  logInfo("Site hero settings updated");
  return getSiteSettingsForEdit();
}

/**
 * Updates booking policy and/or currency in one call (the admin form submits
 * both sections together) and immediately refreshes the in-memory runtime
 * cache (runtime-settings.cache.js) so the new values take effect for the
 * very next request - no restart, no propagation delay. Validates the reschedule
 * tier ordering here rather than relying only on the schema's per-field `min` -
 * the schema can't express a relationship BETWEEN two fields (floor < cutoff),
 * only bounds on each field individually.
 */
export async function updatePolicy({ bookingPolicy, currency }) {
  if (bookingPolicy) {
    const numericFields = [
      "bufferMinutes",
      "slotGridMinutes",
      "userCancellationCutoffHours",
      "rescheduleCutoffHours",
      "rescheduleSameDayFloorHours",
      "rescheduleMinLeadMinutes",
    ];
    for (const field of numericFields) {
      const value = bookingPolicy[field];
      if (typeof value !== "number" || isNaN(value) || value < 0) {
        badRequest(`Neispravna vrednost za "${field}" u politici zakazivanja`);
      }
    }

    if (bookingPolicy.rescheduleSameDayFloorHours >= bookingPolicy.rescheduleCutoffHours) {
      badRequest("Prag za pomeranje istog dana mora biti manji od roka za slobodno pomeranje");
    }
  }

  await siteSettingsRepo.updateSiteSettings({
    ...(bookingPolicy ? { bookingPolicy } : {}),
    ...(currency ? { currency } : {}),
  });

  await runtimeSettingsCache.loadRuntimeSettings();
  logInfo("Booking policy / currency settings updated", { bookingPolicy, currency });
  return getSiteSettingsForEdit();
}

export default { getHeroContent, getSiteSettingsForEdit, updateHero, updatePolicy };