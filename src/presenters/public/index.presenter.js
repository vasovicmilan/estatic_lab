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

const LEGAL_CONTACT = {
  company: BUSINESS.legalName,
  address: BUSINESS.address.full,
  email: BUSINESS.email,
  phone: BUSINESS.phone,
  phoneHref: BUSINESS.phoneHref,
  // null until the business registration is done - views check for these
  // before rendering rather than assuming they're always present.
  taxId: BUSINESS.taxId,
  registrationNumber: BUSINESS.registrationNumber,
};

// Shared with prepareHomeData below (home.ejs) and prepareContactPageData
// (public/contact.ejs) - same physical location, so the address text and map
// embed are only ever defined once.
const MAP_ADDRESS = "Maksima Gorkog 6b, Novi Sad 21120";
const MAP_EMBED_PARAM =
  "!1m18!1m12!1m3!1d2808.909996570131!2d19.843611977018323!3d45.24961274772971!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b106c892d2953%3A0x78a7de03d4dbf444!2sMaksima%20Gorkog%206b%2C%20Novi%20Sad%2021120!5e0!3m2!1sen!2srs!4v1784121266023!5m2!1sen!2srs";
const MAP_EMBED_URL = `https://www.google.com/maps/embed?pb=${MAP_EMBED_PARAM}`;
const GOOGLE_DATA_NOTICE = {
  text:
    "Ukoliko se registrujete ili prijavite putem Google naloga, sa Google-a primamo samo osnovne podatke vašeg profila - ime, prezime i email adresu. Ove podatke koristimo isključivo za kreiranje i povezivanje vašeg korisničkog naloga na Estetik Lab platformi, kako biste mogli da zakazujete termine i pratite svoje rezervacije. Ne delimo ih sa trećim licima niti ih koristimo u druge svrhe bez vaše saglasnosti.",
  privacyUrl: "/politika-privatnosti",
};

export function prepareAboutPageData(content = DEFAULT_ABOUT) {
  return {
    intro: content.intro,
    contact: LEGAL_CONTACT,
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
    contact: LEGAL_CONTACT,
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
    contact: LEGAL_CONTACT,
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
} = {}) {
  return {
    hero: {
          eyebrow: "Estetik Lab wellness centar",
          title: "Estetik Lab kozmetički salon za negu lica, tela i opuštanje",
          subtitle:
            "Masaže, ESMA tretmani i nega lica i tela u mirnom, opuštajućem ambijentu - uz stručan tim i individualan pristup svakom klijentu.",
          ctaLabel: "Zakažite termin",
          ctaUrl: "/usluge",
          secondaryCtaLabel: "Pogledajte pakete",
          secondaryCtaUrl: "/paketi",
          // admin-editable via /admin/sajt (see site-settings.service.js's
          // getHeroContent) - falls back to the original hardcoded image if
          // heroContent wasn't passed in (e.g. a caller that skips
          // index.service.js's getLandingPageData entirely)
          image: heroContent?.image || "/images/site/hero-medium.webp",
          imageAlt: heroContent?.imageAlt || "",
          // {thumb, medium, original} for the <img srcset> in landing/home.ejs -
          // heroContent already carries this when it comes through
          // site-settings.service.js's getHeroContent, but re-derived here too
          // so a caller that only passes {image, imageAlt} still gets a working
          // srcset instead of silently losing it.
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

    map: {
      address: MAP_ADDRESS,
      embedUrl: MAP_EMBED_URL,
    },
    googleDataNotice: GOOGLE_DATA_NOTICE,
  };
}

export function prepareContactPageData() {
  return {
    intro: {
      eyebrow: "Kontakt",
      title: "Zakažite termin ili nam pošaljite poruku",
      lead:
        "Tu smo za sva pitanja o tretmanima, terminima i paketima - javite nam se telefonom, mejlom ili putem forme ispod, a odgovaramo u najkraćem roku.",
    },
    contact: LEGAL_CONTACT,
    map: {
      address: MAP_ADDRESS,
      embedUrl: MAP_EMBED_URL,
    },
    googleDataNotice: GOOGLE_DATA_NOTICE,
    breadcrumbs: [{ label: "Kontakt", url: null }],
  };
}

export function preparePartnershipPageData(content = DEFAULT_PARTNERSHIP) {
  return {
    intro: content.intro,
    steps: content.steps,
    highlights: content.highlights,
    contact: LEGAL_CONTACT,
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