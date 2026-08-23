import siteSettingsRepo from "../repositories/site-settings.repository.js";
import { logInfo } from "../utils/logger.util.js";

// Falls back to the original hardcoded hero image if an admin hasn't uploaded
// one yet - so a brand-new deployment (or one where the settings document
// somehow ended up with hero.image = null) never renders a broken <img>.
const DEFAULT_HERO_IMAGE = "/images/site/hero-medium.webp";

/**
 * Public-facing read - used by index.presenter.js to build the homepage hero
 * section. Returns plain data, not a mongoose document, and always returns a
 * usable image (see DEFAULT_HERO_IMAGE above) so the presenter never has to
 * know or care whether an admin has customized it yet.
 */
export async function getHeroContent() {
  const settings = await siteSettingsRepo.findOrCreateSiteSettings();
  return {
    image: settings.hero?.image || DEFAULT_HERO_IMAGE,
    imageAlt: settings.hero?.imageAlt || "",
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
  };
}

export async function updateHero({ image, imageAlt }) {
  const existing = await siteSettingsRepo.findOrCreateSiteSettings();
  const updated = await siteSettingsRepo.updateSiteSettings({
    hero: {
      // a new upload always wins; omitting `image` (no new file chosen) keeps
      // whatever was already stored instead of wiping it back to null
      image: image !== undefined ? image : existing.hero?.image || null,
      imageAlt: imageAlt !== undefined ? imageAlt : existing.hero?.imageAlt || "",
    },
  });
  logInfo("Site hero settings updated", { image: updated.hero?.image });
  return getSiteSettingsForEdit();
}

export default { getHeroContent, getSiteSettingsForEdit, updateHero };