// Single source of truth for Estetik Lab's real-world business identity -
// physical location, contact channels, and legal name. Consumed by both the
// public contact page (index.presenter.js) and the site-wide Organization
// JSON-LD (seo/organization.builder.js), so a future address/phone change
// only needs updating here once instead of drifting between the two.
export const BUSINESS = {
  name: "Estetik Lab",
  legalName: "Estetik Lab wellness centar",
  email: "estetik.lab.ns@gmail.com",
  phone: "+381 65 977 4000",
  phoneHref: "+38165977400",

  address: {
    streetAddress: "Maksima Gorkog 6b",
    addressLocality: "Novi Sad",
    postalCode: "21120",
    addressCountry: "RS",
    full: "Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija",
  },

  // Extracted from the Google Maps embed URL already used on /kontakt and the
  // homepage (the "!2d...!3d..." params in MAP_EMBED_PARAM - 2d is longitude,
  // 3d is latitude) - real coordinates, not approximated from the address text.
  geo: {
    latitude: 45.24961274772971,
    longitude: 19.843611977018323,
  },

  // Reuses the same default OG image already referenced in seo/index.js as a
  // fallback - no separate logo asset is confirmed to exist yet. Swap this to
  // a real square logo path once one is available; schema.org/logo technically
  // wants a square-ish image, which default-og.webp likely isn't.
  logo: "/images/site/default-og.webp",

  // TODO: no public social profiles or posted opening hours exist anywhere in
  // the codebase yet. Once real Instagram/Facebook/Google Business Profile
  // URLs and posted hours exist, fill these in - organization.builder.js
  // already picks them up automatically and omits the fields while empty.
  // `sameAs` in particular is one of the strongest entity-verification signals
  // for both Google's Knowledge Panel and AI answer engines.
  sameAs: [],
  openingHours: [],
};

export default BUSINESS;