import BUSINESS from "../config/business.config.js";

// Rendered once per request into every page via res.locals.orgJsonLd (set in
// locals.config.js) - unlike generateSeo()'s per-type builders, this doesn't vary
// by page, so it doesn't go through that registry. Previously this was a static
// block hardcoded directly into head.ejs with only name/url/email/address; this
// adds telephone/geo/logo and picks up sameAs/openingHours automatically once
// real values exist in business.config.js.
export function buildOrganizationJsonLd(req) {
  const base = `${req.protocol}://${req.get("host")}`;

  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    url: base,
    email: BUSINESS.email,
    telephone: BUSINESS.phone,
    image: `${base}${BUSINESS.logo}`,
    logo: `${base}${BUSINESS.logo}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.address.streetAddress,
      addressLocality: BUSINESS.address.addressLocality,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    },
    ...(BUSINESS.sameAs.length ? { sameAs: BUSINESS.sameAs } : {}),
    ...(BUSINESS.openingHours.length ? { openingHoursSpecification: BUSINESS.openingHours } : {}),
  };
}

export default { buildOrganizationJsonLd };