import { buildInitialSiteContent } from "../config/site-content-seed.js";
import SiteContent from "../models/site-content.model.js";
import { createTtlCache } from "../utils/ttl-cache.util.js";

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
  const [created] = await SiteContent.create([buildInitialSiteContent()], { session });
  return created;
}

/**
 * Merges (not replaces) top-level section fields into the singleton, e.g.
 * updateSiteContent({ about: {...} }) only touches `about`, leaving every
 * other section (faq, privacyPolicy, ...) untouched - callers pass one
 * section at a time (see site-content.service.js's updateXxx functions), so a
 * saved edit to the FAQ can never accidentally wipe the About page's content.
 */
// The whole SiteContent document (about, FAQ, privacy, terms, home intro, hero, SEO ...) is
// read several times per public page view - the homepage alone calls five getters, each one a
// separate full-document DB read - yet it only changes when an admin saves it. So reads are
// served from a short in-process cache; every write below clears it. (PM2 cluster mode: other
// workers pick the edit up within the TTL - see ttl-cache.util.js.)
const contentCache = createTtlCache(60 * 1000, 1);
const CACHE_KEY = "site-content";

/**
 * READ-ONLY accessor for public pages: returns a fresh plain-object copy of the (cached)
 * document on every call, so callers can never mutate the cached copy or each other's data.
 * Anything that edits content must go through updateSiteContent, never through this.
 */
export async function findSiteContentCached() {
  // goes through the exported object (not the local function) so unit tests that mock
  // findOrCreateSiteContent keep working; the cache is bypassed under NODE_ENV=test
  const useCache = process.env.NODE_ENV !== "test";
  let doc = useCache ? contentCache.get(CACHE_KEY) : undefined;
  if (!doc) {
    doc = await repo.findOrCreateSiteContent();
    if (useCache) contentCache.set(CACHE_KEY, doc);
  }
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

export async function updateSiteContent(data, { session } = {}) {
  const content = await findOrCreateSiteContent({ session });
  Object.assign(content, data);
  content.markModified(Object.keys(data)[0]);
  await content.save({ session });
  contentCache.clear();
  return content;
}

const repo = { findOrCreateSiteContent, findSiteContentCached, updateSiteContent };

export default repo;
