import BUSINESS from "../../config/business.config.js";
import { getResponsiveImageUrls } from "../../utils/image-format.util.js";
import {
  DEFAULT_ABOUT,
  DEFAULT_FAQ,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PARTNERSHIP,
  DEFAULT_HOME_INTRO,
  DEFAULT_WHY_US,
  DEFAULT_HOME_HERO,
  DEFAULT_CONTACT_PAGE,
} from "../../config/site-content-defaults.js";

// About/FAQ/Privacy/Terms/Partnership/home-intro/"why us" copy used to be
// hardcoded literal constants right here - it now lives in the DB (see
// models/site-content.model.js, services/site-content.service.js) so an
// admin can edit it without a code deploy. Every prepareXxxData() below takes
// that content as a parameter instead of reading a module-level constant; the
// DEFAULT_* imports above are ONLY a fallback for a caller that doesn't pass
// content (there shouldn't be one left after this change - both
// controllers/web/index.controller.js and the /api/v1 public controller now
// fetch from siteContentService first), so this presenter never crashes into
// undefined content if a caller is ever added that forgets to.

// A function, not a constant: business identity is admin-editable (Podešavanja sajta -> Podaci o
// firmi) and BUSINESS is mutated live, so it has to be read per request, not once at import.
const legalContact = () => ({
  company: BUSINESS.legalName,
  address: BUSINESS.address.full,
  email: BUSINESS.email,
  phone: BUSINESS.phone,
  phoneHref: BUSINESS.phoneHref,
  // null until the business registration is done - views check for these
  // before rendering rather than assuming they're always present.
  taxId: BUSINESS.taxId,
  registrationNumber: BUSINESS.registrationNumber,
});

// Adresa / mapa / Google napomena su u SiteContent.contactPage (admin: Tekstovi sajta -> Kontakt).
function buildMap(content) {
  return { address: content.mapAddress, embedUrl: content.mapEmbedUrl };
}
function buildGoogleNotice(content) {
  return { text: content.googleDataNotice, privacyUrl: "/politika-privatnosti" };
}

export function prepareAboutPageData(content = DEFAULT_ABOUT) {
  return {
    intro: content.intro,
    contact: legalContact(),
    sections: content.sections,
  };
}

export function prepareFaqPageData(content = DEFAULT_FAQ) {
  return {
    items: content.items,
  };
}

export function preparePrivacyPolicyData(content = DEFAULT_PRIVACY_POLICY) {
  return {
    lastUpdated: content.lastUpdated,
    intro: content.intro,
    contact: legalContact(),
    sections: content.sections,
  };
}

// The literal sections/subsections array below is now unreachable (kept
// nowhere - see DEFAULT_PRIVACY_POLICY in site-content-defaults.js for the
// live copy of this same content) and is removed; preparePrivacyPolicyData
// above now takes its `sections` from whatever is passed in.
export function prepareTermsAndConditionsData(content = DEFAULT_TERMS_AND_CONDITIONS) {
  return {
    lastUpdated: content.lastUpdated,
    intro: content.intro,
    contact: legalContact(),
    sections: content.sections,
  };
}

export function prepareHomeData({
  highlightedServices = [],
  featuredExperts = [],
  testimonials = [],
  latestPosts = [],
  bestPackages = [],
  heroContent = null,
  homeIntro = DEFAULT_HOME_INTRO,
  whyUs = DEFAULT_WHY_US,
  homeHero = DEFAULT_HOME_HERO,
  contactPage = DEFAULT_CONTACT_PAGE,
} = {}) {
  return {
    hero: {
      ...homeHero,
      // slika je u SiteSettings (admin: /admin/sajt) - vidi site-settings.service.js getHeroContent
      image: heroContent?.image || "/images/site/hero-medium.webp",
      imageAlt: heroContent?.imageAlt || "",
      imageVariants: heroContent?.imageVariants || getResponsiveImageUrls(heroContent?.image || "/images/site/hero-medium.webp"),
    },

    // intro/whyUs are now DB-backed content (site-content.service.js's
    // getHomeIntro/getWhyUs) instead of literal constants here - see this
    // file's header comment. Defaults above are only a fallback for a caller
    // that doesn't pass them.
    intro: homeIntro,

    whyUs,
    highlightedServices,
    featuredExperts,
    testimonials,
    bestPackages,
    latestPosts,
    testimonialFormAction: "/testimonials/posalji",

    map: buildMap(contactPage),
    googleDataNotice: buildGoogleNotice(contactPage),
  };
}

export function prepareContactPageData(content = DEFAULT_CONTACT_PAGE) {
  return {
    intro: { eyebrow: content.eyebrow, title: content.title, lead: content.lead },
    contact: legalContact(),
    map: buildMap(content),
    googleDataNotice: buildGoogleNotice(content),
    breadcrumbs: [{ label: "Kontakt", url: null }],
  };
}

export function preparePartnershipPageData(content = DEFAULT_PARTNERSHIP) {
  return {
    intro: content.intro,
    steps: content.steps,
    highlights: content.highlights,
    contact: legalContact(),
  };
}

export default {
  prepareHomeData,
  preparePrivacyPolicyData,
  prepareTermsAndConditionsData,
  prepareAboutPageData,
  prepareFaqPageData,
  preparePartnershipPageData,
  prepareContactPageData,
};