// Presenter za web admin "Tekstovi sajta" (SiteContent singleton - O nama, FAQ,
// politika privatnosti, uslovi korišćenja, partnerski program, uvod na početnoj,
// "Zašto mi", uvod tima).
//
// Ovaj sadržaj je ranije mogao da se menja samo preko API-ja
// (routes/api/v1/admin-ops.routes.js -> /site-content/*). Ovde je isti podatak
// izložen i običnom web admin panelu.
//
// Svaka sekcija se opisuje malim "schema" nizom polja koje generički
// admin/marketing/site-content.ejs + public/js/admin-site-content.js
// umeju da iscrtaju:
//   text / textarea - obično polje
//   lines           - textarea, jedan red = jedna stavka (niz stringova)
//   items           - ponavljajuća lista objekata (itemFields opisuje polja)
//   sections        - graditelj sekcija (naslov, paragrafi, lista, zaključni
//                     paragrafi, pod-sekcije jednog nivoa)

import { PAGE_SEO_PAGES } from "../../../config/site-content-defaults.js";

export const SITE_CONTENT_SECTIONS = [
  {
    key: "about",
    slug: "o-nama",
    title: "O nama",
    icon: "bi-info-circle",
    publicUrl: "/o-nama",
    description: "Uvod i sekcije stranice „O nama“.",
  },
  {
    key: "faq",
    slug: "faq",
    title: "Česta pitanja (FAQ)",
    icon: "bi-question-circle",
    publicUrl: "/faq",
    description: "Pitanja i odgovori na stranici FAQ.",
  },
  {
    key: "privacyPolicy",
    slug: "politika-privatnosti",
    title: "Politika privatnosti",
    icon: "bi-shield-check",
    publicUrl: "/politika-privatnosti",
    description: "Pravni tekst politike privatnosti.",
  },
  {
    key: "termsAndConditions",
    slug: "uslovi-koriscenja",
    title: "Uslovi korišćenja",
    icon: "bi-file-earmark-text",
    publicUrl: "/uslovi-koriscenja",
    description: "Pravni tekst uslova korišćenja.",
  },
  {
    key: "partnership",
    slug: "partnerski-program",
    title: "Partnerski program",
    icon: "bi-people",
    publicUrl: "/partnerski-program",
    description: "Uvod, koraci i prednosti partnerskog programa.",
  },
  {
    key: "homeIntro",
    slug: "pocetna-uvod",
    title: "Uvod na početnoj strani",
    icon: "bi-house-heart",
    publicUrl: "/",
    description: "Naslov, uvodni tekstovi i lista masaža na početnoj strani.",
  },
  {
    key: "whyUs",
    slug: "zasto-mi",
    title: "Zašto mi",
    icon: "bi-stars",
    publicUrl: "/",
    description: "Kartice „Zašto Estetik Lab“ na početnoj strani.",
  },
  {
    key: "teamIntro",
    slug: "tim-uvod",
    title: "Uvod stranice Naš tim",
    icon: "bi-person-badge",
    publicUrl: "/nas-tim",
    description: "Naslov, uvod i istaknute stavke na stranici tima.",
  },
  {
    key: "homeHero",
    slug: "pocetna-hero",
    title: "Hero početne strane",
    icon: "bi-image",
    publicUrl: "/",
    description: "Naslov, podnaslov i dugmad na vrhu početne strane (slika se menja u Podešavanjima sajta).",
  },
  {
    key: "servicesIntro",
    slug: "usluge-uvod",
    title: "Uvod stranice Usluge",
    icon: "bi-card-heading",
    publicUrl: "/usluge",
    description: "Uvodni tekst i istaknute stavke na stranici Usluge.",
  },
  {
    key: "packagesIntro",
    slug: "paketi-uvod",
    title: "Uvod stranice Paketi",
    icon: "bi-box-seam",
    publicUrl: "/paketi",
    description: "Uvodni tekst i istaknute stavke na stranici Paketi.",
  },
  {
    key: "shopIntro",
    slug: "prodavnica-uvod",
    title: "Uvod prodavnice (+ poverenje i pitanja)",
    icon: "bi-shop",
    publicUrl: "/prodavnica",
    description: "Uvodni tekst, „zašto kod nas“ kartice i česta pitanja na stranici Prodavnica.",
  },
  {
    key: "blogIntro",
    slug: "blog-uvod",
    title: "Uvod stranice Blog",
    icon: "bi-journal-richtext",
    publicUrl: "/blog",
    description: "Uvodni tekst i istaknute stavke na stranici Blog.",
  },
  {
    key: "contactPage",
    slug: "kontakt",
    title: "Kontakt stranica i lokacija",
    icon: "bi-geo-alt",
    publicUrl: "/kontakt",
    description: "Uvod kontakt stranice, adresa i mapa, napomena o Google prijavi.",
  },
  {
    key: "pageSeo",
    slug: "seo-stranica",
    title: "SEO stranica (naslov i opis za Google)",
    icon: "bi-search",
    publicUrl: "/",
    description: "Naslov (title) i opis (meta description) svake javne stranice - prikazuje se u Google rezultatima i pri deljenju linka.",
  },
];

export function findSectionBySlug(slug) {
  return SITE_CONTENT_SECTIONS.find((section) => section.slug === slug) || null;
}

const ICON_HELP = "Naziv Bootstrap ikone, npr. bi-heart-pulse (pogledajte icons.getbootstrap.com).";
const HTML_HELP = "Dozvoljen je HTML (npr. <a href=\"/kontakt\">link</a>).";

// ---- field schemas -----------------------------------------------------------

const SCHEMAS = {
  about: [
    { name: "intro", label: "Uvodni tekst", type: "textarea", rows: 4, required: true },
    { name: "sections", label: "Sekcije", type: "sections", addLabel: "Dodaj sekciju", help: HTML_HELP },
  ],
  faq: [
    {
      name: "items",
      label: "Pitanja i odgovori",
      type: "items",
      addLabel: "Dodaj pitanje",
      itemFields: [
        { name: "pitanje", label: "Pitanje", type: "text", required: true },
        { name: "odgovor", label: "Odgovor", type: "textarea", rows: 3, required: true },
      ],
      help: HTML_HELP,
    },
  ],
  privacyPolicy: [
    { name: "lastUpdated", label: "Poslednje ažuriranje (tekst koji se prikazuje)", type: "text", required: true, width: 6 },
    { name: "intro", label: "Uvodni tekst", type: "textarea", rows: 4, required: true },
    { name: "sections", label: "Sekcije", type: "sections", addLabel: "Dodaj sekciju", help: HTML_HELP },
  ],
  termsAndConditions: [
    { name: "lastUpdated", label: "Poslednje ažuriranje (tekst koji se prikazuje)", type: "text", required: true, width: 6 },
    { name: "intro", label: "Uvodni tekst", type: "textarea", rows: 4, required: true },
    { name: "sections", label: "Sekcije", type: "sections", addLabel: "Dodaj sekciju", help: HTML_HELP },
  ],
  partnership: [
    { name: "intro", label: "Uvodni tekst", type: "textarea", rows: 4, required: true },
    {
      name: "steps",
      label: "Koraci (redni broj se dodeljuje automatski po redosledu)",
      type: "items",
      addLabel: "Dodaj korak",
      itemFields: [
        { name: "title", label: "Naslov koraka", type: "text", required: true },
        { name: "description", label: "Opis koraka", type: "textarea", rows: 3, required: true },
      ],
      help: HTML_HELP,
    },
    { name: "highlights", label: "Prednosti (jedna prednost po redu)", type: "lines", rows: 5 },
  ],
  homeIntro: [
    { name: "title", label: "Naslov", type: "text", required: true },
    { name: "lead", label: "Uvodni paragraf", type: "textarea", rows: 4, required: true },
    { name: "who", label: "Kome su tretmani namenjeni", type: "textarea", rows: 4, required: true },
    {
      name: "massages",
      label: "Masaže (kartice sa linkom)",
      type: "items",
      addLabel: "Dodaj masažu",
      itemFields: [
        { name: "title", label: "Naziv", type: "text", required: true },
        { name: "text", label: "Kratak opis", type: "text", required: true },
        { name: "href", label: "Link (npr. /usluge/relaks-masaza)", type: "text" },
      ],
    },
    { name: "packages", label: "Tekst o paketima", type: "textarea", rows: 3, required: true },
    { name: "closing", label: "Završni tekst", type: "textarea", rows: 3, required: true },
  ],
  whyUs: [
    {
      name: "whyUs",
      label: "Kartice „Zašto mi“",
      type: "items",
      addLabel: "Dodaj karticu",
      itemFields: [
        { name: "icon", label: "Ikona", type: "text", placeholder: "bi-patch-check", help: ICON_HELP },
        { name: "title", label: "Naslov", type: "text", required: true },
        { name: "text", label: "Tekst", type: "textarea", rows: 2, required: true },
      ],
    },
  ],
  teamIntro: [
    { name: "eyebrow", label: "Mali naslov iznad (eyebrow)", type: "text", required: true, width: 6 },
    { name: "title", label: "Naslov", type: "text", required: true, width: 6 },
    { name: "lead", label: "Uvodni tekst", type: "textarea", rows: 4, required: true },
    {
      name: "highlights",
      label: "Istaknute stavke",
      type: "items",
      addLabel: "Dodaj stavku",
      itemFields: [
        { name: "icon", label: "Ikona", type: "text", placeholder: "bi-patch-check", help: ICON_HELP },
        { name: "title", label: "Naslov", type: "text", required: true },
        { name: "text", label: "Tekst", type: "textarea", rows: 2, required: true },
      ],
    },
  ],
};

const INTRO_FIELDS = [
  { name: "eyebrow", label: "Mali naslov iznad (eyebrow)", type: "text", required: true, width: 6 },
  { name: "title", label: "Naslov (H1)", type: "text", required: true, width: 6 },
  { name: "lead", label: "Uvodni paragraf", type: "textarea", rows: 3, required: true },
  { name: "paragraphs", label: "Dodatni paragrafi (jedan po redu)", type: "lines", rows: 4 },
];
const ICON_ITEM_FIELDS = [
  { name: "icon", label: "Ikona", type: "text", placeholder: "bi-patch-check", help: ICON_HELP },
  { name: "title", label: "Naslov", type: "text", required: true },
  { name: "text", label: "Tekst", type: "textarea", rows: 2, required: true },
];
const HIGHLIGHTS_FIELD = { name: "highlights", label: "Istaknute stavke", type: "items", addLabel: "Dodaj stavku", itemFields: ICON_ITEM_FIELDS };

SCHEMAS.servicesIntro = [...INTRO_FIELDS, HIGHLIGHTS_FIELD];
SCHEMAS.packagesIntro = [...INTRO_FIELDS, HIGHLIGHTS_FIELD];
SCHEMAS.blogIntro = [...INTRO_FIELDS, HIGHLIGHTS_FIELD];
SCHEMAS.shopIntro = [
  ...INTRO_FIELDS,
  { name: "trust", label: "„Zašto kod nas“ kartice", type: "items", addLabel: "Dodaj karticu", itemFields: ICON_ITEM_FIELDS },
  {
    name: "faq",
    label: "Česta pitanja o kupovini (idu i u FAQ strukturirane podatke)",
    type: "items",
    addLabel: "Dodaj pitanje",
    itemFields: [
      { name: "pitanje", label: "Pitanje", type: "text", required: true },
      { name: "odgovor", label: "Odgovor", type: "textarea", rows: 3, required: true },
    ],
  },
];
SCHEMAS.homeHero = [
  { name: "eyebrow", label: "Mali naslov iznad (eyebrow)", type: "text", required: true },
  { name: "title", label: "Naslov (H1)", type: "text", required: true },
  { name: "subtitle", label: "Podnaslov", type: "textarea", rows: 3, required: true },
  { name: "ctaLabel", label: "Glavno dugme - tekst", type: "text", required: true, width: 6 },
  { name: "ctaUrl", label: "Glavno dugme - link", type: "text", required: true, width: 6 },
  { name: "secondaryCtaLabel", label: "Sporedno dugme - tekst", type: "text", required: true, width: 6 },
  { name: "secondaryCtaUrl", label: "Sporedno dugme - link", type: "text", required: true, width: 6 },
];
SCHEMAS.contactPage = [
  { name: "eyebrow", label: "Mali naslov iznad (eyebrow)", type: "text", required: true, width: 6 },
  { name: "title", label: "Naslov (H1)", type: "text", required: true, width: 6 },
  { name: "lead", label: "Uvodni paragraf", type: "textarea", rows: 3, required: true },
  { name: "mapAddress", label: "Adresa (prikaz uz mapu)", type: "text", required: true },
  { name: "mapEmbedUrl", label: "Google Maps embed link", type: "textarea", rows: 3, help: "Google Maps → Share → Embed a map → kopirajte samo src adresu (počinje sa https://www.google.com/maps/embed). Prazno = bez mape." },
  { name: "googleDataNotice", label: "Napomena o Google prijavi", type: "textarea", rows: 4, required: true },
];

// SEO stranica: po dva polja za svaku stranicu iz PAGE_SEO_PAGES. Ime polja je
// `${stranica}__title|description` (kontroler ih isto tako čita).
SCHEMAS.pageSeo = Object.entries(PAGE_SEO_PAGES).flatMap(([key, page]) => [
  { name: `${key}__title`, label: `${page.label} - SEO naslov`, type: "text", required: true, width: 5, help: `Javna adresa: ${page.path}. Preporuka do 60 karaktera.` },
  { name: `${key}__description`, label: `${page.label} - SEO opis`, type: "textarea", rows: 2, required: true, width: 7, help: "Preporuka 120-160 karaktera." },
]);

// ---- helpers -----------------------------------------------------------------

function plain(value) {
  // Mongoose subdocument nizovi (Mixed) su već obični objekti, ali JSON round-trip
  // garantuje da view dobija čist, serijalizabilan podatak.
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Vrednost za jedno polje iz "content[sectionKey]" objekta. */
function readFieldValue(sectionKey, fieldName, sectionContent) {
  // whyUs je jedini ključ čiji je sadržaj direktno niz (nema omotača).
  if (sectionKey === "whyUs") return plain(sectionContent);
  if (sectionKey === "pageSeo") {
    const [pageKey, prop] = fieldName.split("__");
    return plain(sectionContent?.[pageKey]?.[prop]);
  }
  return plain(sectionContent ? sectionContent[fieldName] : undefined);
}

function fieldWithValue(sectionKey, field, sectionContent) {
  const raw = readFieldValue(sectionKey, field.name, sectionContent);
  const next = { ...field };

  if (field.type === "lines") {
    next.value = Array.isArray(raw) ? raw.join("\n") : "";
  } else if (field.type === "items" || field.type === "sections") {
    next.value = Array.isArray(raw) ? raw : [];
  } else {
    next.value = raw === undefined || raw === null ? "" : raw;
  }
  return next;
}

// ---- public API --------------------------------------------------------------

export function prepareSiteContentIndexData(content) {
  const summarize = (section) => {
    const value = content ? content[section.key] : undefined;
    let summary = "";
    if (section.key === "about" || section.key === "privacyPolicy" || section.key === "termsAndConditions") {
      const count = Array.isArray(value?.sections) ? value.sections.length : 0;
      summary = `${count} ${count === 1 ? "sekcija" : "sekcija"}`;
      if (value?.lastUpdated) summary += ` · ažurirano: ${value.lastUpdated}`;
    } else if (section.key === "faq") {
      summary = `${Array.isArray(value?.items) ? value.items.length : 0} pitanja`;
    } else if (section.key === "partnership") {
      summary = `${Array.isArray(value?.steps) ? value.steps.length : 0} koraka`;
    } else if (section.key === "homeIntro") {
      summary = `${Array.isArray(value?.massages) ? value.massages.length : 0} masaža`;
    } else if (section.key === "whyUs") {
      summary = `${Array.isArray(value) ? value.length : 0} kartica`;
    } else if (["servicesIntro", "packagesIntro", "blogIntro"].includes(section.key)) {
      summary = `${Array.isArray(value?.highlights) ? value.highlights.length : 0} istaknutih stavki`;
    } else if (section.key === "shopIntro") {
      summary = `${Array.isArray(value?.trust) ? value.trust.length : 0} kartica · ${Array.isArray(value?.faq) ? value.faq.length : 0} pitanja`;
    } else if (section.key === "homeHero" || section.key === "contactPage") {
      summary = value?.title || "";
    } else if (section.key === "pageSeo") {
      summary = `${Object.keys(PAGE_SEO_PAGES).length} stranica`;
    } else if (section.key === "teamIntro") {
      summary = `${Array.isArray(value?.highlights) ? value.highlights.length : 0} istaknutih stavki`;
    }
    return {
      title: section.title,
      description: section.description,
      icon: section.icon,
      summary,
      publicUrl: section.publicUrl,
      editUrl: `/admin/sajt/sadrzaj/${section.slug}`,
    };
  };

  return {
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tekstovi sajta", url: null },
    ],
    cards: SITE_CONTENT_SECTIONS.map(summarize),
    settingsUrl: "/admin/sajt",
  };
}

/**
 * @param {string} sectionKey  npr. "about"
 * @param {object} sectionContent  sadržaj TE sekcije (content[sectionKey]); za
 *   "whyUs" je to direktno niz kartica.
 */
export function prepareSiteContentFormData(sectionKey, sectionContent) {
  const section = SITE_CONTENT_SECTIONS.find((item) => item.key === sectionKey);
  const schema = SCHEMAS[sectionKey] || [];

  return {
    sectionTitle: section.title,
    sectionDescription: section.description,
    publicUrl: section.publicUrl,
    formAction: `/admin/sajt/sadrzaj/${section.slug}`,
    formMethod: "PUT",
    isEdit: true,
    cancelUrl: "/admin/sajt/sadrzaj",
    submitLabel: "Sačuvaj",
    fields: schema.map((field) => fieldWithValue(sectionKey, field, sectionContent)),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Tekstovi sajta", url: "/admin/sajt/sadrzaj" },
      { label: section.title, url: null },
    ],
  };
}

export default { SITE_CONTENT_SECTIONS, findSectionBySlug, prepareSiteContentIndexData, prepareSiteContentFormData };
