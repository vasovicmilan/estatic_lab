import BUSINESS from "../config/business.config.js";
import employeeService from "../services/employee.service.js";
import runtimeSettingsCache from "../config/runtime-settings.cache.js";

// Rendered once per request into every page via res.locals.orgJsonLd (set in
// locals.config.js) - unlike generateSeo()'s per-type builders, this doesn't vary
// by page, so it doesn't go through that registry.
//
// openingHoursSpecification prefers the admin-editable, salon-wide FIXED
// schedule (site-settings.model.js's workingHours - see admin/sajt) once one
// has actually been configured (hasFixedWorkingHours() - "unconfigured" means
// every day still defaults to isOpen: false), and only falls back to
// employeeService.getAggregateBusinessHours() - hours derived from whichever
// employees happen to have a shift that day - when the admin hasn't set fixed
// hours yet. Same reasoning as before for why a derived fallback exists at
// all (there's no fixed schedule to hardcode by default), but a real,
// intentional salon schedule is now allowed to take over once one exists,
// since "when are we open" is a business decision an admin should be able to
// state directly rather than always inferring it from who happens to be
// scheduled. getAggregateBusinessHours() stays cached in-memory
// (employee.service.js) and getWorkingHours()/hasFixedWorkingHours() are
// synchronous cache reads (runtime-settings.cache.js) - neither path costs a
// DB round trip on a normal request.
async function resolveOpeningHours() {
  if (runtimeSettingsCache.hasFixedWorkingHours()) {
    return runtimeSettingsCache
      .getWorkingHours()
      .filter((wh) => wh.isOpen)
      .map((wh) => ({
        dayOfWeek: wh.day.charAt(0).toUpperCase() + wh.day.slice(1),
        opens: wh.from,
        closes: wh.to,
      }));
  }
  return employeeService.getAggregateBusinessHours();
}

export async function buildOrganizationJsonLd(req) {
  const base = `${req.protocol}://${req.get("host")}`;
  const hours = await resolveOpeningHours();

  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    alternateName: BUSINESS.alternateName,
    url: base,
    email: BUSINESS.email,
    telephone: BUSINESS.phone,
    // PIB / matični broj aren't assigned yet (business registration pending),
    // so these are omitted entirely rather than emitted as null/empty -
    // schema.org validators flag empty required-looking fields, and an
    // absent property is the correct way to say "not applicable yet".
    // taxID is schema.org's dedicated field for PIB. Matični broj has no
    // dedicated schema.org property (it isn't a VAT number, so vatID would
    // be a misuse), so it goes through the generic identifier/PropertyValue
    // pattern instead, tagged so it's unambiguous in the JSON-LD output.
    ...(BUSINESS.taxId ? { taxID: BUSINESS.taxId } : {}),
    ...(BUSINESS.registrationNumber
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "MB",
            value: BUSINESS.registrationNumber,
          },
        }
      : {}),
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