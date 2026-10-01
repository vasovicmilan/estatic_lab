// Single source of truth for Estetik Lab's real-world business identity -
// physical location, contact channels, and legal name. Consumed by both the
// public contact page (index.presenter.js) and the site-wide Organization
// JSON-LD (seo/organization.builder.js), so a future address/phone change
// only needs updating here once instead of drifting between the two.
// WHITE_LABEL=true: nova klijentska instanca (npr. samo prodavnica + blog). Kodni default-i
// ispod (naziv, PIB, adresa, telefon, društvene mreže, domen...) pripadaju Estetik Lab-u i NE
// smeju da procure na tuđ sajt (Organization JSON-LD, footer, pravne stranice, canonical), pa se
// u tom režimu zamenjuju neutralnim vrednostima - naziv iz SITE_NAME, ostalo prazno dok admin ne
// popuni "Podaci o firmi" u Podešavanjima sajta.
export const WHITE_LABEL = /^(1|true|yes)$/i.test(String(process.env.WHITE_LABEL || "").trim());

const ESTETIK_BUSINESS = {
  // name / email / adminEmail / phone / address / geo / taxId / registrationNumber / sameAs and the
  // rest of the fields below are only the CODE DEFAULTS: once an admin saves "Podaci o firmi" in
  // Podešavanja sajta (SiteSettings.business), those values override them live - see
  // resolveBusiness()/applyBusinessSettings() at the bottom of this file and
  // config/runtime-settings.cache.js. SITE_NAME / SUPPORT_EMAIL / ADMIN_EMAIL env vars are honoured
  // as defaults for name / email / adminEmail (precedence: admin settings > env > this file).
  name: process.env.SITE_NAME || "Estetik Lab",
  legalName: "Estetik Lab wellness centar",
  // kratki slogan u footer-u; prazno = ne prikazuje se
  tagline: "Vaš prostor za opuštanje i negu.",
  // Schema.org's correct field for a trading/AKA name distinct from the legal
  // name - the domain is beautymedica.rs, but "Beauty Medica" appeared nowhere
  // in the site's own content or structured data before this, so a search for
  // that name had nothing on-site to match against.
  alternateName: "Beauty Medica",
  email: process.env.SUPPORT_EMAIL || "estetik.lab.ns@gmail.com",
  // where admin notifications (new appointment / order / contact...) are mailed
  adminEmail: process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || "estetik.lab.ns@gmail.com",
  phone: "+381 65 977 4000",
  // Bug fix: this was missing the trailing "0" ("+38165977400", 11 digits)
  // against the 12-digit displayed number above - every tel: link on the site
  // (kontakt page, footer, etc.) was dialing a wrong/nonexistent number.
  phoneHref: "+381659774000",

  // Canonical site origin - single source of truth for every "BASE_URL" that used
  // to be redefined with its own fallback in ~10 separate files (email.service.js,
  // seo/index.js, cors.config.js, campaign.service.js, google-calendar.service.js,
  // telegram.listener.js, partner-account controller/presenter...).
  //
  // DECISION (confirmed by site owner): beautymedica.rs (bare, no www) is the
  // registered/intended domain. www is kept only as a DNS alias that must
  // redirect to the bare domain at the edge (Cloudflare Redirect Rule +
  // nginx server block, both outside this codebase) - it should never be
  // the canonical form.
  //
  // NOTE: this used to default to the www form after a prior investigation
  // into the bare apex domain occasionally getting bot-detection-style
  // challenges from an external fetch tool. That was very likely a
  // Cloudflare-level challenge (Bot Fight Mode / WAF) unrelated to this
  // codebase's own isLikelyBot() check (utils/bot-detection.util.js), which
  // only inspects User-Agent and has no host/domain logic at all - and both
  // beautymedica.rs and www.beautymedica.rs are Proxied (orange-cloud) through
  // the same Cloudflare zone, so neither form has a structural reliability
  // difference. Reverted to the bare domain per the owner's explicit call.
  //
  // Entity pages (usluge/prodavnica/paketi/blog post) build their canonical
  // from req.protocol + req.get("host") (see seo/utils.seo.js buildCanonical),
  // NOT from this value - so this fix only holds if the edge (Cloudflare +
  // nginx) always redirects www -> bare before the request reaches Node.
  // Without that edge redirect, a crawler hitting www directly would still
  // get a self-referencing www canonical on catalog pages.
  siteUrl: process.env.BASE_URL || "https://beautymedica.rs",

  // Not yet registered as a legal entity (paušalac registration pending -
  // see internal notes). Left null on purpose rather than a placeholder
  // string, so every consumer (footer.ejs, organization.builder.js,
  // index.presenter.js LEGAL_CONTACT) can cleanly omit these fields until
  // there's a real PIB/matični broj to show instead of displaying a blank
  // or a fake-looking value. Fill in once the registration is done - no
  // other file needs to change.
  taxId: "100154658", // PIB
  registrationNumber: "07566905", // Matični broj

  address: {
    streetAddress: "Maksima Gorkog 6b",
    addressLocality: "Novi Sad",
    postalCode: "21120",
    addressCountry: "RS",
    full: "Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija",
  },

  geo: {
    latitude: 45.24961274772971,
    longitude: 19.843611977018323,
  },

  logo: "/images/site/default-og.webp",

  sameAs: [
    "https://www.instagram.com/estetik.lab.ns",
    "https://www.facebook.com/share/1BrebmE8UG/",
    "https://www.youtube.com/channel/UCeM0B40yqnauvr0oKr6t47g",
    "https://www.tiktok.com/@estetik.lab",
  ],

  // TODO: no posted opening hours are stored here - there's no fixed salon
  // schedule, since who's actually working on a given day depends on individual
  // employee schedules (see Employee.workingHours). organization.builder.js
  // derives real "hours when at least one active employee is here" dynamically
  // via employeeService.getAggregateBusinessHours() instead.
};

const NEUTRAL_NAME = process.env.SITE_NAME || "Moja firma";
const NEUTRAL_BUSINESS = {
  name: NEUTRAL_NAME,
  legalName: NEUTRAL_NAME,
  alternateName: null,
  tagline: "",
  email: process.env.SUPPORT_EMAIL || "",
  adminEmail: process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || "",
  phone: "",
  phoneHref: "",
  siteUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  taxId: null,
  registrationNumber: null,
  address: { streetAddress: "", addressLocality: "", postalCode: "", addressCountry: "RS", full: "" },
  geo: { latitude: null, longitude: null },
  logo: "/images/site/default-og.webp",
  sameAs: [],
};

export const BUSINESS = WHITE_LABEL ? { ...NEUTRAL_BUSINESS } : { ...ESTETIK_BUSINESS };

// Snapshot of the code/env defaults, taken before any admin override is applied.
export const DEFAULT_BUSINESS = JSON.parse(JSON.stringify(BUSINESS));

const isFilled = (v) => typeof v === "string" && v.trim() !== "";

/** "+381 65 977 4000" / "065 977 4000" / "00381659774000" -> "+381659774000" (tel: href). */
export function toPhoneHref(phone) {
  let digits = String(phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) digits = `+381${digits.slice(1)}`;
  return digits;
}

export function buildFullAddress({ streetAddress, postalCode, addressLocality, addressCountry }) {
  if (!isFilled(streetAddress)) return "";
  const country = !addressCountry || addressCountry === "RS" ? "Republika Srbija" : addressCountry;
  return `${streetAddress}, ${[postalCode, addressLocality].filter(Boolean).join(" ")}, ${country}`;
}

/**
 * Effective business identity = code/env defaults overlaid with whatever an admin stored in
 * SiteSettings.business. Pure (returns a new plain object, touches nothing) so the admin form
 * can show the current effective values too. Derived fields (phoneHref, address.full) are
 * always recomputed, never stored.
 */
export function resolveBusiness(stored) {
  const base = JSON.parse(JSON.stringify(DEFAULT_BUSINESS));
  if (!stored) return base;
  const out = { ...base };
  for (const key of ["name", "legalName", "alternateName", "email", "adminEmail", "phone", "taxId", "registrationNumber"]) {
    if (isFilled(stored[key])) out[key] = stored[key].trim();
  }
  // optional identifiers may be cleared on purpose (not yet registered) - an explicit "" stored wins
  for (const key of ["taxId", "registrationNumber", "alternateName"]) {
    if (typeof stored[key] === "string" && stored[key].trim() === "") out[key] = null;
  }
  out.address = { ...base.address };
  for (const key of ["streetAddress", "addressLocality", "postalCode", "addressCountry"]) {
    if (isFilled(stored.address?.[key])) out.address[key] = stored.address[key].trim();
  }
  out.address.full = buildFullAddress(out.address);
  out.geo = { ...base.geo };
  for (const key of ["latitude", "longitude"]) {
    const n = stored.geo?.[key];
    if (typeof n === "number" && Number.isFinite(n)) out.geo[key] = n;
  }
  if (Array.isArray(stored.sameAs)) out.sameAs = stored.sameAs.filter(isFilled).map((u) => u.trim());
  // no dedicated notification address saved -> follow the (possibly edited) public contact email
  if (!isFilled(stored.adminEmail) && isFilled(stored.email)) out.adminEmail = out.email;
  out.phoneHref = toPhoneHref(out.phone);
  return out;
}

/** Mutates the shared BUSINESS object in place, so every module holding a reference sees the change. */
export function applyBusinessSettings(stored) {
  Object.assign(BUSINESS, resolveBusiness(stored));
  return BUSINESS;
}

export default BUSINESS;