import BUSINESS from "../config/business.config.js";
import employeeService from "../services/employee.service.js";

// Rendered once per request into every page via res.locals.orgJsonLd (set in
// locals.config.js) - unlike generateSeo()'s per-type builders, this doesn't vary
// by page, so it doesn't go through that registry.
//
// openingHoursSpecification comes from employeeService.getAggregateBusinessHours()
// rather than a hardcoded schedule - there's no fixed salon schedule to hardcode,
// since who's actually here on a given day depends on individual employee
// schedules. That function is cached in-memory (see employee.service.js), so this
// doesn't cost a DB round trip on every request.
export async function buildOrganizationJsonLd(req) {
  const base = `${req.protocol}://${req.get("host")}`;
  const hours = await employeeService.getAggregateBusinessHours();

  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    alternateName: BUSINESS.alternateName,
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
    ...(hours.length
      ? {
          openingHoursSpecification: hours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: h.dayOfWeek,
            opens: h.opens,
            closes: h.closes,
          })),
        }
      : {}),
  };
}

export default { buildOrganizationJsonLd };