import { BUSINESS, WHITE_LABEL } from "./business.config.js";
import { FEATURES } from "./features.config.js";
import {
  DEFAULT_ABOUT,
  DEFAULT_FAQ,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PARTNERSHIP,
  DEFAULT_SHOP_INTRO,
  DEFAULT_SHOP_TRUST,
  DEFAULT_SHOP_FAQ,
  DEFAULT_BLOG_INTRO,
  DEFAULT_CONTACT_PAGE,
  PAGE_SEO_PAGES,
  DEFAULT_PAGE_SEO,
} from "./site-content-defaults.js";

// Početni sadržaj (SiteContent singleton) za NOVU klijentsku instancu.
//
// Kodni default-i u site-content-defaults.js su tekst Estetik Lab-a (masaže, ESMA, Novi Sad, PIB...).
// Singleton se u bazi kreira JEDNOM (findOrCreateSiteContent), pa se za WHITE_LABEL=true umesto tih
// tekstova upisuje neutralan početni sadržaj: brend/kontakt iz BUSINESS, samo delovi koji odgovaraju
// uključenim modulima (ENABLED_MODULES), bez marketinških tvrdnji o tuđoj firmi. Admin sve to
// menja u /admin/sajt/sadrzaj. Estetik Lab instanca (WHITE_LABEL nije postavljen) dobija
// nepromenjene default-e - ova funkcija tada vraća {}.

const clone = (v) => JSON.parse(JSON.stringify(v));

/** "Estetik Lab" (+ padežni nastavak "-a"), e-mail i domen -> podaci trenutne firme. */
export function brandify(value) {
  if (typeof value === "string") {
    const host = (() => {
      try {
        return new URL(BUSINESS.siteUrl).host;
      } catch {
        return BUSINESS.siteUrl;
      }
    })();
    const email = BUSINESS.email || `info@${host.replace(/^www\./, "").replace(/:\d+$/, "")}`;
    const addressText = BUSINESS.address.full || "";
    return value
      .replace(/, sa sedištem na adresi Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija/g, addressText ? `, sa sedištem na adresi ${addressText}` : "")
      .replace(/Maksima Gorkog 6b, (?:21120 )?Novi Sad(?: 21120)?(?:, Republika Srbija)?/g, addressText)
      .replace(/Estetik Lab wellness cent(?:ar|ra|ru|rom)/g, BUSINESS.name)
      .replace(/Estetik Lab-a?/g, BUSINESS.name)
      .replace(/Estetik Lab/g, BUSINESS.name)
      .replace(/estetik\.lab\.ns@gmail\.com/g, email)
      .replace(/beautymedica\.rs/g, host)
      .replace(/ u Novom Sadu/g, BUSINESS.address.addressLocality ? ` u mestu ${BUSINESS.address.addressLocality}` : "");
  }
  if (Array.isArray(value)) return value.map(brandify);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, brandify(v)]));
  return value;
}

const BOOKING_RE = /termin|zakazivan|paket|no-show|nedolazak/i;
const SHOP_RE = /porud[zž]bin|dostav|proizvod|kupovin|odustanak|reklamacij|korpa|kupon/i;

const TEXT_KEYS = ["paragraphs", "list", "closingParagraphs"];

// Rečenica/stavka koja govori samo o isključenom modulu se izbacuje; "mešovite" (pominju i
// uključen i isključen modul) ostaju - bolje višak reči nego izgubljeno pravilo za postojeći modul.
function itemOff(text) {
  const t = String(text);
  const booking = BOOKING_RE.test(t);
  const shop = SHOP_RE.test(t);
  if (!FEATURES.booking && booking && !shop) return true;
  if (!FEATURES.shop && shop && !booking) return true;
  return false;
}

function titleOff(title) {
  return (!FEATURES.booking && (BOOKING_RE.test(title) || /zdravstven/i.test(title))) || (!FEATURES.shop && SHOP_RE.test(title));
}

function pruneBlock(block) {
  const out = { ...block };
  for (const key of TEXT_KEYS) {
    if (Array.isArray(out[key])) out[key] = out[key].filter((item) => !itemOff(item));
  }
  if (Array.isArray(out.subsections)) {
    out.subsections = out.subsections.filter((sub) => !titleOff(String(sub.title || ""))).map(pruneBlock);
  }
  return out;
}

/** Izbacuje sekcije pravnog teksta koje opisuju isključen modul, čisti stavke i renumeriše "N. Naslov". */
function filterLegalSections(sections) {
  let n = 0;
  return sections
    .filter((s) => !titleOff(String(s.title || "")))
    .map(pruneBlock)
    .map((s) => {
      if (!/^\d+\.\s/.test(String(s.title || ""))) return s;
      n += 1;
      return { ...s, title: s.title.replace(/^\d+\./, `${n}.`) };
    });
}

const joinList = (parts) => (parts.length ? `, ${parts.join(" i ")}` : "");

function privacyIntro() {
  const parts = [];
  if (FEATURES.shop) parts.push("kupovine proizvoda iz naše prodavnice");
  if (FEATURES.booking) parts.push("online zakazivanja termina");
  return `Ova Politika privatnosti objašnjava kako ${BUSINESS.name} prikuplja, koristi, čuva i štiti vaše podatke prilikom korišćenja našeg sajta${joinList(parts)} i drugih usluga koje pružamo.`;
}

function termsIntro() {
  const use = [];
  if (FEATURES.shop) use.push("naručivanja proizvoda");
  if (FEATURES.booking) use.push("zakazivanja termina");
  const before = ["registracije", ...use];
  return `Korišćenjem sajta ${BUSINESS.name} prihvatate sledeće Uslove korišćenja. Molimo vas da ih pažljivo pročitate pre ${before.join(", ")} ili slanja poruke putem sajta.`;
}

function homeHero() {
  const primary = FEATURES.shop
    ? { ctaLabel: "Pogledajte ponudu", ctaUrl: "/prodavnica" }
    : FEATURES.blog
      ? { ctaLabel: "Pročitajte blog", ctaUrl: "/blog" }
      : { ctaLabel: "Kontaktirajte nas", ctaUrl: "/kontakt" };
  const secondary = FEATURES.shop && FEATURES.blog
    ? { secondaryCtaLabel: "Pročitajte blog", secondaryCtaUrl: "/blog" }
    : { secondaryCtaLabel: "Kontakt", secondaryCtaUrl: "/kontakt" };
  return {
    eyebrow: BUSINESS.name,
    title: BUSINESS.name,
    subtitle: "Dobrodošli na naš sajt.",
    ...primary,
    ...secondary,
  };
}

function pageSeo() {
  const out = {};
  for (const key of Object.keys(PAGE_SEO_PAGES)) {
    const def = DEFAULT_PAGE_SEO[key];
    out[key] = {
      title: key === "home" ? BUSINESS.name : `${PAGE_SEO_PAGES[key].label} | ${BUSINESS.name}`,
      description: key === "home" ? `Dobrodošli na sajt: ${BUSINESS.name}.` : brandify(def.description),
      noIndex: false,
    };
  }
  return out;
}

export function buildInitialSiteContent() {
  if (!WHITE_LABEL) return {};

  const faqItems = FEATURES.booking ? clone(DEFAULT_FAQ.items) : FEATURES.shop ? clone(DEFAULT_SHOP_FAQ) : [];

  return {
    about: { intro: BUSINESS.name, sections: [] },
    faq: { items: brandify(faqItems) },
    privacyPolicy: {
      lastUpdated: DEFAULT_PRIVACY_POLICY.lastUpdated,
      intro: privacyIntro(),
      sections: brandify(filterLegalSections(clone(DEFAULT_PRIVACY_POLICY.sections))),
    },
    termsAndConditions: {
      lastUpdated: DEFAULT_TERMS_AND_CONDITIONS.lastUpdated,
      intro: termsIntro(),
      sections: brandify(filterLegalSections(clone(DEFAULT_TERMS_AND_CONDITIONS.sections))),
    },
    partnership: brandify(clone(DEFAULT_PARTNERSHIP)),
    homeIntro: { title: `Dobrodošli u ${BUSINESS.name}`, lead: "", who: "", massages: [], packages: "", closing: "" },
    whyUs: [],
    teamIntro: { eyebrow: "Naš tim", title: "Upoznajte naš tim", lead: "", highlights: [] },
    homeHero: homeHero(),
    contactPage: {
      eyebrow: "Kontakt",
      title: "Javite nam se",
      lead: "Tu smo za sva vaša pitanja - javite nam se telefonom, mejlom ili putem forme ispod.",
      mapAddress: BUSINESS.address.full || "",
      mapEmbedUrl: "",
      googleDataNotice: brandify(
        DEFAULT_CONTACT_PAGE.googleDataNotice
          .replace("kako biste mogli da zakazujete termine i pratite svoje rezervacije", "kako biste mogli da pratite svoje porudžbine"),
      ),
    },
    // Uvodi prodavnice/bloga: neutralni (default je o ESMA opremi i masažama). Opšte "trust" stavke
    // (dostava, podrška, odustanak) ostaju, ona o "opremi koju sami koristimo" ne.
    shopIntro: {
      eyebrow: DEFAULT_SHOP_INTRO.eyebrow,
      title: "Naša ponuda",
      lead: `Pogledajte proizvode koje nudi ${BUSINESS.name}.`,
      paragraphs: [],
      trust: clone(DEFAULT_SHOP_TRUST).filter((t) => t.icon !== "bi-patch-check"),
      faq: clone(DEFAULT_SHOP_FAQ),
    },
    blogIntro: { eyebrow: DEFAULT_BLOG_INTRO.eyebrow, title: "Novosti i saveti", lead: `Tekstovi i novosti iz ${BUSINESS.name}.`, paragraphs: [], highlights: [] },
    pageSeo: pageSeo(),
  };
}

export default { buildInitialSiteContent, brandify };
