import siteSettingsRepo from "../repositories/site-settings.repository.js";
import runtimeSettingsCache from "../config/runtime-settings.cache.js";
import { badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { getVerifiedResponsiveImageUrls } from "../utils/image-format.util.js";
import { DAYS_OF_WEEK, TIME_STRING_RE } from "../utils/working-hours.util.js";

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
    commissionPolicy: {
      minimumSessionCommission: settings.commissionPolicy?.minimumSessionCommission,
    },
    // Salon-wide DISPLAY schedule + one-off closures - see
    // site-settings.model.js's WorkingHoursDaySchema/ClosedDateSchema header
    // comments for why this is deliberately separate from
    // Employee.workingHours (the real booking-slot source of truth).
    workingHours: (settings.workingHours || []).map((wh) => ({
      day: wh.day,
      isOpen: !!wh.isOpen,
      from: wh.from,
      to: wh.to,
    })),
    closedDates: (settings.closedDates || []).map((cd) => ({
      date: cd.date,
      reason: cd.reason || "",
      recurringYearly: !!cd.recurringYearly,
    })),
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
export async function updatePolicy({ bookingPolicy, currency, commissionPolicy }) {
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

  if (commissionPolicy) {
    const value = commissionPolicy.minimumSessionCommission;
    if (typeof value !== "number" || isNaN(value) || value < 0) {
      badRequest('Neispravna vrednost za "minimalnu proviziju po seansi iz paketa ili ručno kreiranog termina"');
    }
  }

  await siteSettingsRepo.updateSiteSettings({
    ...(bookingPolicy ? { bookingPolicy } : {}),
    ...(currency ? { currency } : {}),
    ...(commissionPolicy ? { commissionPolicy } : {}),
  });

  await runtimeSettingsCache.loadRuntimeSettings();
  logInfo("Booking policy / currency / commission policy settings updated", { bookingPolicy, currency, commissionPolicy });
  return getSiteSettingsForEdit();
}

/**
 * Replaces the salon-wide DISPLAY working-hours schedule (kontakt/footer/SEO -
 * see site-settings.model.js's WorkingHoursDaySchema). Requires exactly one
 * entry per day of the week, each a valid enum day, no duplicates - unlike
 * Employee.workingHours (a sparse list of whichever days someone actually
 * works), this schedule always has a full 7-day shape so every consumer
 * (footer.ejs, organization.builder.js) can safely index it by day without a
 * "day not found" branch. `from`/`to` are only validated (and required to be
 * from < to) when `isOpen` is true - a closed day's leftover time strings are
 * harmless and just kept as-is for when the day is reopened.
 *
 * Refreshes runtime-settings.cache.js immediately after saving, same as
 * updatePolicy, so the new schedule is live (footer, SEO JSON-LD) on the very
 * next request.
 */
export async function updateWorkingHours(workingHours) {
  if (!Array.isArray(workingHours) || workingHours.length !== 7) {
    badRequest("Radno vreme mora sadržati tačno 7 dana u nedelji");
  }

  const seenDays = new Set();
  const normalized = workingHours.map((entry) => {
    if (!DAYS_OF_WEEK.includes(entry?.day)) {
      badRequest(`Neispravan dan u nedelji: "${entry?.day}"`);
    }
    if (seenDays.has(entry.day)) {
      badRequest(`Dan "${entry.day}" je naveden više puta`);
    }
    seenDays.add(entry.day);

    const isOpen = !!entry.isOpen;
    const from = entry.from || "09:00";
    const to = entry.to || "20:00";

    if (isOpen) {
      if (!TIME_STRING_RE.test(from) || !TIME_STRING_RE.test(to)) {
        badRequest(`Neispravan format vremena za "${entry.day}" (očekivano HH:MM)`);
      }
      if (from >= to) {
        badRequest(`Vreme otvaranja mora biti pre vremena zatvaranja (${entry.day})`);
      }
    }

    return { day: entry.day, isOpen, from, to };
  });

  if (seenDays.size !== 7) {
    badRequest("Radno vreme mora sadržati svih 7 dana u nedelji, bez ponavljanja");
  }

  await siteSettingsRepo.updateSiteSettings({ workingHours: normalized });
  await runtimeSettingsCache.loadRuntimeSettings();
  logInfo("Radno vreme salona (prikaz na sajtu) ažurirano", { workingHours: normalized });
  return getSiteSettingsForEdit();
}

/**
 * Replaces the list of one-off closures/praznici (see
 * site-settings.model.js's ClosedDateSchema) - a full replace, not a merge,
 * matching how the admin UI submits the whole list at once (add/remove rows
 * client-side, then save). Each `date` just needs to parse to a real Date;
 * the calendar-day comparison itself (recurring by month/day, or exact) is
 * runtime-settings.cache.js's isDateClosed, not this function's concern.
 *
 * Refreshes runtime-settings.cache.js immediately, same as updatePolicy/
 * updateWorkingHours, so availability.service.js starts honoring a newly
 * added closed day on the very next slot request.
 */
export async function updateClosedDates(closedDates) {
  if (!Array.isArray(closedDates)) {
    badRequest("Neradni dani moraju biti niz");
  }

  const normalized = closedDates.map((entry) => {
    const date = new Date(entry?.date);
    if (isNaN(date.getTime())) {
      badRequest("Neispravan datum u listi neradnih dana");
    }
    const reason = typeof entry.reason === "string" ? entry.reason.trim().slice(0, 200) : "";
    return { date, reason, recurringYearly: !!entry.recurringYearly };
  });

  await siteSettingsRepo.updateSiteSettings({ closedDates: normalized });
  await runtimeSettingsCache.loadRuntimeSettings();
  logInfo("Neradni dani salona ažurirani", { count: normalized.length });
  return getSiteSettingsForEdit();
}

export default { getHeroContent, getSiteSettingsForEdit, updateHero, updatePolicy, updateWorkingHours, updateClosedDates };