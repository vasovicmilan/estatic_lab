import siteContentRepo from "../repositories/site-content.repository.js";
import { badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

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
  };
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

export default {
  getSiteContent,
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
