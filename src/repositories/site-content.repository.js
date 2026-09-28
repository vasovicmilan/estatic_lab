import SiteContent from "../models/site-content.model.js";

/**
 * Returns the one SiteContent document, creating it with schema defaults
 * (site-content-defaults.js) on first-ever call - exact same pattern as
 * site-settings.repository.js's findOrCreateSiteSettings. Every other
 * function in site-content.service.js routes through this rather than a raw
 * findOne, so there's never a code path that has to handle "no content
 * document exists yet" beyond this single point.
 */
export async function findOrCreateSiteContent({ session } = {}) {
  const existing = await SiteContent.findOne().session(session || null);
  if (existing) return existing;
  const [created] = await SiteContent.create([{}], { session });
  return created;
}

/**
 * Merges (not replaces) top-level section fields into the singleton, e.g.
 * updateSiteContent({ about: {...} }) only touches `about`, leaving every
 * other section (faq, privacyPolicy, ...) untouched - callers pass one
 * section at a time (see site-content.service.js's updateXxx functions), so a
 * saved edit to the FAQ can never accidentally wipe the About page's content.
 */
export async function updateSiteContent(data, { session } = {}) {
  const content = await findOrCreateSiteContent({ session });
  Object.assign(content, data);
  content.markModified(Object.keys(data)[0]);
  await content.save({ session });
  return content;
}

export default { findOrCreateSiteContent, updateSiteContent };
