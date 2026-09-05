// Single source of truth for Estetik Lab's real-world business identity -
// physical location, contact channels, and legal name. Consumed by both the
// public contact page (index.presenter.js) and the site-wide Organization
// JSON-LD (seo/organization.builder.js), so a future address/phone change
// only needs updating here once instead of drifting between the two.
export const BUSINESS = {
  name: "Estetik Lab",
  legalName: "Estetik Lab wellness centar",
  // Schema.org's correct field for a trading/AKA name distinct from the legal
  // name - the domain is beautymedica.rs, but "Beauty Medica" appeared nowhere
  // in the site's own content or structured data before this, so a search for
  // that name had nothing on-site to match against.
  alternateName: "Beauty Medica",
  email: "estetik.lab.ns@gmail.com",
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

export default BUSINESS;