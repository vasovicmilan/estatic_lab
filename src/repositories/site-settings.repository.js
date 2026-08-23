import SiteSettings from "../models/site-settings.model.js";

/**
 * Returns the one SiteSettings document, creating it with schema defaults on
 * first-ever call. Every other function in this repository assumes this has
 * already been called at least once (site-settings.service.js always routes
 * through this rather than a raw findOne), so there's never a code path that
 * has to handle "no settings document exists yet" beyond this single point.
 */
export async function findOrCreateSiteSettings({ session } = {}) {
  const existing = await SiteSettings.findOne().session(session || null);
  if (existing) return existing;
  const [created] = await SiteSettings.create([{}], { session });
  return created;
}

export async function updateSiteSettings(data, { session } = {}) {
  const settings = await findOrCreateSiteSettings({ session });
  Object.assign(settings, data);
  await settings.save({ session });
  return settings;
}

export default { findOrCreateSiteSettings, updateSiteSettings };