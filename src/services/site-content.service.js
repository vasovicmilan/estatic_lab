import { FEATURES } from "../config/features.config.js";
import siteContentRepo from "../repositories/site-content.repository.js";
import { badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { buildPageSeo } from "../seo/index.js";
import {
  DEFAULT_PAGE_SEO,
  PAGE_SEO_PAGES,
  DEFAULT_HOME_HERO,
  DEFAULT_CONTACT_PAGE,
  DEFAULT_SERVICES_INTRO,
  DEFAULT_PACKAGES_INTRO,
  DEFAULT_BLOG_INTRO,
  DEFAULT_SHOP_INTRO,
  DEFAULT_SHOP_TRUST,
  DEFAULT_SHOP_FAQ,
} from "../config/site-content-defaults.js";

/**
 * Site-wide marketing/legal CONTENT (About, FAQ, Privacy Policy, Terms,
 * Partnership program, home page intro + "why us", team page intro) - see
 * models/site-content.model.js's header comment for why this is a separate
 * singleton from SiteSettings (config) rather than more fields on it.
 *
 * Every getXxx() here returns the exact same shape whether the caller is the
 * public API/EJS presenter or the admin edit screen - unlike SiteSettings
 * (which has a getHeroContent public read with a DEFAULT_HERO_IMAGE fallback
 * vs. a raw getSiteSettingsForEdit), nothing in this document is ever
 * "unset" in a way that needs a display-time fallback: the schema defaults
 * (site-content-defaults.js) already guarantee every field has real content
 * from the moment the singleton is first created, so admin and public reads
 * can safely be the same function.
 */

export async function getSiteContent() {
  const content = await siteContentRepo.findOrCreateSiteContent();
  return {
    about: { intro: content.about.intro, sections: content.about.sections },
    faq: { items: content.faq.items },
    privacyPolicy: { lastUpdated: content.privacyPolicy.lastUpdated, intro: content.privacyPolicy.intro, sections: content.privacyPolicy.sections },
    termsAndConditions: {
      lastUpdated: content.termsAndConditions.lastUpdated,
      intro: content.termsAndConditions.intro,
      sections: content.termsAndConditions.sections,
    },
    partnership: { intro: content.partnership.intro, steps: content.partnership.steps, highlights: content.partnership.highlights },
    homeIntro: {
      title: content.homeIntro.title,
      lead: content.homeIntro.lead,
      who: content.homeIntro.who,
      massages: content.homeIntro.massages,
      packages: content.homeIntro.packages,
      closing: content.homeIntro.closing,
    },
    whyUs: content.whyUs,
    teamIntro: {
      eyebrow: content.teamIntro.eyebrow,
      title: content.teamIntro.title,
      lead: content.teamIntro.lead,
      highlights: content.teamIntro.highlights,
    },
    pageSeo: onlyAvailablePages(mergePageSeo(content.pageSeo)),
    homeHero: withDefaults(content.homeHero, DEFAULT_HOME_HERO),
    contactPage: withDefaults(content.contactPage, DEFAULT_CONTACT_PAGE),
    servicesIntro: withDefaults(content.servicesIntro, DEFAULT_SERVICES_INTRO),
    packagesIntro: withDefaults(content.packagesIntro, DEFAULT_PACKAGES_INTRO),
    blogIntro: withDefaults(content.blogIntro, DEFAULT_BLOG_INTRO),
    shopIntro: withDefaults(content.shopIntro, { ...DEFAULT_SHOP_INTRO, trust: DEFAULT_SHOP_TRUST, faq: DEFAULT_SHOP_FAQ }),
  };
}

/** Sačuvani objekat + default za svako polje koje fali (dokument nastao pre uvođenja sekcije). */
function withDefaults(stored, defaults) {
  const source = stored && typeof stored === "object" ? JSON.parse(JSON.stringify(stored)) : {};
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = source[key] === undefined || source[key] === null ? JSON.parse(JSON.stringify(defaults[key])) : source[key];
  }
  return result;
}

/**
 * Dopunjava sačuvani pageSeo defaultima: dokument nastao pre uvođenja ovog
 * polja (ili kome fali novi ključ/prazno polje) i dalje vraća pun, upotrebljiv
 * skup - nikad "undefined" title na javnoj stranici.
 */
function mergePageSeo(stored) {
  const source = stored && typeof stored === "object" ? stored : {};
  const result = {};
  for (const key of Object.keys(PAGE_SEO_PAGES)) {
    const saved = source[key] && typeof source[key] === "object" ? source[key] : {};
    const def = DEFAULT_PAGE_SEO[key];
    result[key] = {
      // label/path se ne čuvaju u bazi (kod ih definiše) - vraćaju se samo da admin UI
      // ne mora da drži sopstvenu listu stranica.
      label: PAGE_SEO_PAGES[key].label,
      path: PAGE_SEO_PAGES[key].path,
      title: typeof saved.title === "string" && saved.title.trim() ? saved.title.trim() : def.title,
      description: typeof saved.description === "string" && saved.description.trim() ? saved.description.trim() : def.description,
      noIndex: saved.noIndex === true,
    };
  }
  return result;
}

// Stranice koje pripadaju modulu - kad je modul isključen stranica ne postoji (404), pa se ne
// nudi ni u adminu ni kroz javni API.
export const PAGE_MODULES = { services: "booking", packages: "booking", products: "shop", blog: "blog", partnership: "partners" };

export function isPageAvailable(key) {
  const moduleName = PAGE_MODULES[key];
  return !moduleName || !!FEATURES[moduleName];
}

function onlyAvailablePages(seo) {
  return Object.fromEntries(Object.entries(seo).filter(([key]) => isPageAvailable(key)));
}

export function isPageSeoKey(key) {
  return Object.prototype.hasOwnProperty.call(PAGE_SEO_PAGES, key);
}

export async function getPageSeoAll() {
  const content = await siteContentRepo.findOrCreateSiteContent();
  return mergePageSeo(content.pageSeo);
}

/** { key, path, title, description, noIndex } za jednu statičku stranicu. */
export async function getPageSeoConfig(key) {
  if (!isPageSeoKey(key)) badRequest(`Nepoznata stranica za SEO: ${key}`);
  const all = await getPageSeoAll();
  return { key, path: PAGE_SEO_PAGES[key].path, ...all[key] };
}

export async function getAbout() {
  return (await getSiteContent()).about;
}

export async function getFaq() {
  return (await getSiteContent()).faq;
}

export async function getPrivacyPolicy() {
  return (await getSiteContent()).privacyPolicy;
}

export async function getTermsAndConditions() {
  return (await getSiteContent()).termsAndConditions;
}

export async function getPartnership() {
  return (await getSiteContent()).partnership;
}

export async function getHomeIntro() {
  return (await getSiteContent()).homeIntro;
}

export async function getWhyUs() {
  return (await getSiteContent()).whyUs;
}

export async function getTeamIntro() {
  return (await getSiteContent()).teamIntro;
}

// ---- Shape validation shared by every updateXxx below ----
// Still deliberately lighter than a full per-field Mongoose schema (matching
// this document's intentionally loose Mixed-typed storage - see the model's
// header comment) - this content is edited by a trusted admin, not user
// input from the public internet. But since the admin frontend now edits
// `sections` through a proper structured builder (shared/ui/sections-builder,
// not a raw JSON textarea - see that component's header comment on the
// frontend), it can only ever produce a `ContentSection[]` in the exact shape
// below, so the backend can now afford to actually validate that whole shape
// (recursively through one level of subsections) rather than the previous
// "does it have a title?" check alone - a malformed request from anywhere
// else (a stray script, a hand-crafted API call) is now rejected before it
// ever reaches the database, instead of silently saving a section with a
// non-array `paragraphs` or a numeric `list` entry that would then fail to
// render on the public content-sections component.

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    badRequest(`Polje "${label}" je obavezno`);
  }
  return value.trim();
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    badRequest(`Polje "${label}" mora biti niz`);
  }
  return value;
}

/** Validates an optional `paragraphs`/`list`/`closingParagraphs`-style field:
 * absent/undefined is fine (all three are optional on a ContentSection), but
 * if present it must be an array of plain strings (empty strings included -
 * the builder can leave a just-added row blank while the admin is typing). */
function optionalStringArray(value, label) {
  if (value === undefined || value === null) return value;
  requireArray(value, label);
  for (const item of value) {
    if (typeof item !== "string") {
      badRequest(`Polje "${label}" mora sadržati samo tekstualne stavke`);
    }
  }
  return value;
}

/** Validates one `ContentSection` (or `ContentSubsection`) node - title
 * required, the three text-array fields optional-but-typed, and `subsections`
 * (only meaningful one level deep in practice, since the admin builder never
 * creates a deeper level) recursively validated the same way. `path` is a
 * human-readable breadcrumb used in the error message so a validation
 * failure on section 3's second subsection says exactly that. */
function validateSectionShape(section, path) {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    badRequest(`Sekcija (${path}) mora biti objekat`);
  }
  requireNonEmptyString(section.title, `naslov (${path})`);
  optionalStringArray(section.paragraphs, `paragraphs (${path})`);
  optionalStringArray(section.list, `list (${path})`);
  optionalStringArray(section.closingParagraphs, `closingParagraphs (${path})`);
  if (section.subsections !== undefined && section.subsections !== null) {
    requireArray(section.subsections, `subsections (${path})`);
    section.subsections.forEach((sub, index) => validateSectionShape(sub, `${path} > pod-sekcija ${index + 1}`));
  }
}

function requireSections(sections) {
  requireArray(sections, "sections");
  sections.forEach((section, index) => validateSectionShape(section, `sekcija ${index + 1}`));
  return sections;
}

export async function updateAbout({ intro, sections }) {
  const normalized = { intro: requireNonEmptyString(intro, "intro"), sections: requireSections(sections) };
  await siteContentRepo.updateSiteContent({ about: normalized });
  logInfo("Sadržaj stranice 'O nama' ažuriran");
  return getAbout();
}

export async function updateFaq({ items }) {
  requireArray(items, "items");
  for (const item of items) {
    if (!item || !requireNonEmptyString(item.pitanje, "pitanje") || !requireNonEmptyString(item.odgovor, "odgovor")) {
      badRequest("Svako FAQ pitanje mora imati i pitanje i odgovor");
    }
  }
  await siteContentRepo.updateSiteContent({ faq: { items } });
  logInfo("FAQ sadržaj ažuriran", { count: items.length });
  return getFaq();
}

export async function updatePrivacyPolicy({ lastUpdated, intro, sections }) {
  const normalized = {
    lastUpdated: requireNonEmptyString(lastUpdated, "lastUpdated"),
    intro: requireNonEmptyString(intro, "intro"),
    sections: requireSections(sections),
  };
  await siteContentRepo.updateSiteContent({ privacyPolicy: normalized });
  logInfo("Politika privatnosti ažurirana");
  return getPrivacyPolicy();
}

export async function updateTermsAndConditions({ lastUpdated, intro, sections }) {
  const normalized = {
    lastUpdated: requireNonEmptyString(lastUpdated, "lastUpdated"),
    intro: requireNonEmptyString(intro, "intro"),
    sections: requireSections(sections),
  };
  await siteContentRepo.updateSiteContent({ termsAndConditions: normalized });
  logInfo("Uslovi korišćenja ažurirani");
  return getTermsAndConditions();
}

export async function updatePartnership({ intro, steps, highlights }) {
  requireArray(steps, "steps");
  for (const step of steps) {
    if (!step || !requireNonEmptyString(step.title, "title (korak)") || !requireNonEmptyString(step.description, "description (korak)")) {
      badRequest("Svaki korak partnerskog programa mora imati naslov i opis");
    }
    // `number` is what landing/partnership.ejs prints in each step's numbered
    // circle - not just a label, so a missing/non-numeric value would render
    // as a literal "undefined" on the public page instead of failing loudly
    // here where an admin can actually see the error.
    if (typeof step.number !== "number" || !Number.isFinite(step.number)) {
      badRequest("Svaki korak partnerskog programa mora imati redni broj (number)");
    }
  }
  requireArray(highlights, "highlights");
  const normalized = { intro: requireNonEmptyString(intro, "intro"), steps, highlights: highlights.map(String) };
  await siteContentRepo.updateSiteContent({ partnership: normalized });
  logInfo("Sadržaj partnerskog programa ažuriran");
  return getPartnership();
}

export async function updateHomeIntro({ title, lead, who, massages, packages, closing }) {
  requireArray(massages, "massages");
  const normalized = {
    title: requireNonEmptyString(title, "title"),
    lead: requireNonEmptyString(lead, "lead"),
    who: requireNonEmptyString(who, "who"),
    massages,
    packages: requireNonEmptyString(packages, "packages"),
    closing: requireNonEmptyString(closing, "closing"),
  };
  await siteContentRepo.updateSiteContent({ homeIntro: normalized });
  logInfo("Uvodni sadržaj početne strane ažuriran");
  return getHomeIntro();
}

export async function updateWhyUs(whyUs) {
  requireArray(whyUs, "whyUs");
  for (const item of whyUs) {
    if (!item || !requireNonEmptyString(item.title, "title") || !requireNonEmptyString(item.text, "text")) {
      badRequest('Svaka stavka "Zašto mi" mora imati naslov i tekst');
    }
  }
  await siteContentRepo.updateSiteContent({ whyUs });
  logInfo('Sadržaj "Zašto mi" ažuriran', { count: whyUs.length });
  return getWhyUs();
}

export async function updateTeamIntro({ eyebrow, title, lead, highlights }) {
  requireArray(highlights, "highlights");
  const normalized = {
    eyebrow: requireNonEmptyString(eyebrow, "eyebrow"),
    title: requireNonEmptyString(title, "title"),
    lead: requireNonEmptyString(lead, "lead"),
    highlights,
  };
  await siteContentRepo.updateSiteContent({ teamIntro: normalized });
  logInfo("Uvodni sadržaj tim stranice ažuriran");
  return getTeamIntro();
}

/** SEO objekat za EJS stranice bez `req` (isti oblik kao buildPageSeo), iz baze. */
export async function getStaticPageSeo(key, overrides = {}) {
  const config = await getPageSeoConfig(key);
  return buildPageSeo({
    title: config.title,
    description: config.description,
    canonical: config.path,
    isIndexable: !config.noIndex,
    ...overrides,
  });
}

// Linkovi/dugmad hero-a koje je admin (ili stari default) usmerio na modul koji je u ovoj instanci
// isključen ("/usluge", "/paketi", "/zakazivanje" bez booking-a, "/prodavnica" bez shop-a, "/blog"
// bez bloga) vode na 404 - umesto toga se prikazuje prvi dostupan cilj, sa odgovarajućom oznakom.
const MODULE_LINKS = [
  { re: /^\/(usluge|paketi|zakazivanje)(\/|\?|$)/, module: "booking" },
  { re: /^\/prodavnica(\/|\?|$)/, module: "shop" },
  { re: /^\/blog(\/|\?|$)/, module: "blog" },
];
const LINK_FALLBACKS = [
  { url: "/prodavnica", module: "shop", label: "Pogledajte ponudu" },
  { url: "/blog", module: "blog", label: "Pročitajte blog" },
  { url: "/kontakt", module: null, label: "Kontaktirajte nas" },
];

function isLinkAvailable(url) {
  const hit = MODULE_LINKS.find((m) => m.re.test(String(url || "")));
  return !hit || FEATURES[hit.module];
}

export function adaptHeroToModules(hero) {
  const out = { ...hero };
  const used = new Set();
  for (const [urlKey, labelKey] of [["ctaUrl", "ctaLabel"], ["secondaryCtaUrl", "secondaryCtaLabel"]]) {
    if (isLinkAvailable(out[urlKey]) && !used.has(out[urlKey])) {
      used.add(out[urlKey]);
      continue;
    }
    const next = LINK_FALLBACKS.find((f) => (!f.module || FEATURES[f.module]) && !used.has(f.url));
    if (next) {
      out[urlKey] = next.url;
      out[labelKey] = next.label;
      used.add(next.url);
    }
  }
  return out;
}

export async function getHomeHero() {
  return adaptHeroToModules((await getSiteContent()).homeHero);
}
export async function getContactPage() {
  return (await getSiteContent()).contactPage;
}
export async function getServicesIntro() {
  return (await getSiteContent()).servicesIntro;
}
export async function getPackagesIntro() {
  return (await getSiteContent()).packagesIntro;
}
export async function getBlogIntro() {
  return (await getSiteContent()).blogIntro;
}
export async function getShopIntro() {
  return (await getSiteContent()).shopIntro;
}

function requireStringArray(value, label) {
  requireArray(value, label);
  return value.map((item) => {
    if (typeof item !== "string") badRequest(`Polje "${label}" mora sadržati samo tekstualne stavke`);
    return item.trim();
  }).filter(Boolean);
}

function requireIconItems(items, label) {
  requireArray(items, label);
  return items.map((item) => {
    if (!item || typeof item !== "object") badRequest(`Stavka u "${label}" mora biti objekat`);
    return {
      icon: typeof item.icon === "string" ? item.icon.trim() : "",
      title: requireNonEmptyString(item.title, `naslov (${label})`),
      text: requireNonEmptyString(item.text, `tekst (${label})`),
    };
  });
}

function normalizeIntro({ eyebrow, title, lead, paragraphs, highlights }) {
  return {
    eyebrow: requireNonEmptyString(eyebrow, "eyebrow"),
    title: requireNonEmptyString(title, "title"),
    lead: requireNonEmptyString(lead, "lead"),
    paragraphs: requireStringArray(paragraphs ?? [], "paragraphs"),
    highlights: requireIconItems(highlights ?? [], "highlights"),
  };
}

export async function updateServicesIntro(payload) {
  await siteContentRepo.updateSiteContent({ servicesIntro: normalizeIntro(payload || {}) });
  logInfo("Uvod stranice Usluge ažuriran");
  return getServicesIntro();
}

export async function updatePackagesIntro(payload) {
  await siteContentRepo.updateSiteContent({ packagesIntro: normalizeIntro(payload || {}) });
  logInfo("Uvod stranice Paketi ažuriran");
  return getPackagesIntro();
}

export async function updateBlogIntro(payload) {
  await siteContentRepo.updateSiteContent({ blogIntro: normalizeIntro(payload || {}) });
  logInfo("Uvod stranice Blog ažuriran");
  return getBlogIntro();
}

export async function updateShopIntro(payload = {}) {
  const { eyebrow, title, lead, paragraphs, trust, faq } = payload;
  requireArray(faq ?? [], "faq");
  const normalized = {
    eyebrow: requireNonEmptyString(eyebrow, "eyebrow"),
    title: requireNonEmptyString(title, "title"),
    lead: requireNonEmptyString(lead, "lead"),
    paragraphs: requireStringArray(paragraphs ?? [], "paragraphs"),
    trust: requireIconItems(trust ?? [], "trust"),
    faq: (faq ?? []).map((item) => ({
      pitanje: requireNonEmptyString(item?.pitanje, "pitanje"),
      odgovor: requireNonEmptyString(item?.odgovor, "odgovor"),
    })),
  };
  await siteContentRepo.updateSiteContent({ shopIntro: normalized });
  logInfo("Uvod prodavnice ažuriran");
  return getShopIntro();
}

export async function updateHomeHero(payload = {}) {
  const normalized = {
    eyebrow: requireNonEmptyString(payload.eyebrow, "eyebrow"),
    title: requireNonEmptyString(payload.title, "title"),
    subtitle: requireNonEmptyString(payload.subtitle, "subtitle"),
    ctaLabel: requireNonEmptyString(payload.ctaLabel, "ctaLabel"),
    ctaUrl: requireNonEmptyString(payload.ctaUrl, "ctaUrl"),
    secondaryCtaLabel: requireNonEmptyString(payload.secondaryCtaLabel, "secondaryCtaLabel"),
    secondaryCtaUrl: requireNonEmptyString(payload.secondaryCtaUrl, "secondaryCtaUrl"),
  };
  await siteContentRepo.updateSiteContent({ homeHero: normalized });
  logInfo("Hero početne strane ažuriran");
  return getHomeHero();
}

export async function updateContactPage(payload = {}) {
  const mapEmbedUrl = typeof payload.mapEmbedUrl === "string" ? payload.mapEmbedUrl.trim() : "";
  if (mapEmbedUrl && !/^https:\/\/www\.google\.com\/maps\/embed/.test(mapEmbedUrl)) {
    badRequest('Polje "mapEmbedUrl" mora počinjati sa https://www.google.com/maps/embed');
  }
  const normalized = {
    eyebrow: requireNonEmptyString(payload.eyebrow, "eyebrow"),
    title: requireNonEmptyString(payload.title, "title"),
    lead: requireNonEmptyString(payload.lead, "lead"),
    mapAddress: requireNonEmptyString(payload.mapAddress, "mapAddress"),
    mapEmbedUrl,
    googleDataNotice: requireNonEmptyString(payload.googleDataNotice, "googleDataNotice"),
  };
  await siteContentRepo.updateSiteContent({ contactPage: normalized });
  logInfo("Kontakt stranica ažurirana");
  return getContactPage();
}

const PAGE_SEO_TITLE_MAX = 120;
const PAGE_SEO_DESCRIPTION_MAX = 320;

export async function updatePageSeo(pages) {
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) badRequest('Polje "pageSeo" mora biti objekat');
  const current = await getPageSeoAll();
  const next = { ...current };
  for (const [key, value] of Object.entries(pages)) {
    if (!isPageSeoKey(key)) badRequest(`Nepoznata stranica za SEO: ${key}`);
    if (!isPageAvailable(key)) continue; // modul isključen - stranica ne postoji, ostaje netaknuta
    if (!value || typeof value !== "object") badRequest(`SEO podaci za "${PAGE_SEO_PAGES[key].label}" moraju biti objekat`);
    const label = PAGE_SEO_PAGES[key].label;
    const title = requireNonEmptyString(value.title, `SEO naslov (${label})`);
    const description = requireNonEmptyString(value.description, `SEO opis (${label})`);
    if (title.length > PAGE_SEO_TITLE_MAX) badRequest(`SEO naslov (${label}) može imati najviše ${PAGE_SEO_TITLE_MAX} karaktera`);
    if (description.length > PAGE_SEO_DESCRIPTION_MAX) badRequest(`SEO opis (${label}) može imati najviše ${PAGE_SEO_DESCRIPTION_MAX} karaktera`);
    const noIndex = value.noIndex === undefined ? current[key].noIndex : value.noIndex === true || value.noIndex === "on" || value.noIndex === "true";
    next[key] = { title, description, noIndex };
  }
  await siteContentRepo.updateSiteContent({ pageSeo: next });
  logInfo("SEO statičkih stranica ažuriran", { pages: Object.keys(pages) });
  return onlyAvailablePages(await getPageSeoAll());
}

export default {
  getSiteContent,
  getPageSeoAll,
  getPageSeoConfig,
  getHomeHero, getContactPage, getServicesIntro, getPackagesIntro, getBlogIntro, getShopIntro,
  updateHomeHero, updateContactPage, updateServicesIntro, updatePackagesIntro, updateBlogIntro, updateShopIntro,
  getStaticPageSeo,
  isPageSeoKey,
  isPageAvailable,
  updatePageSeo,
  getAbout,
  getFaq,
  getPrivacyPolicy,
  getTermsAndConditions,
  getPartnership,
  getHomeIntro,
  getWhyUs,
  getTeamIntro,
  updateAbout,
  updateFaq,
  updatePrivacyPolicy,
  updateTermsAndConditions,
  updatePartnership,
  updateHomeIntro,
  updateWhyUs,
  updateTeamIntro,
};
