import { truncate, escape, buildCanonical, buildBreadcrumbJsonLd, buildAggregateRatingJsonLd, buildReviewJsonLd } from "../utils.seo.js";
import { getCurrency } from "../../config/runtime-settings.cache.js";

// Each service package/tier (5 seansi, 10 seansi, ...) becomes its own Offer -
// a service genuinely has multiple purchasable tiers at different prices, unlike
// a simple fixed-price page, so a single price field would misrepresent it.
function buildServiceOffers(service) {
  const variants = (service.varijante || []).filter((v) => v.aktivan !== false && typeof v.cenaRaw === "number");
  if (variants.length === 0) return undefined;
  return variants.map((v) => ({
    "@type": "Offer",
    name: v.naziv,
    priceCurrency: getCurrency().code,
    price: v.cenaRaw,
    availability: "https://schema.org/InStock",
  }));
}

function buildServiceJsonLd(service, canonical, imageUrl, siteName) {
  const offers = buildServiceOffers(service);
  const aggregateRating = buildAggregateRatingJsonLd(service.ratingSummary);
  const review = buildReviewJsonLd(service.recenzije);

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": canonical,
    name: service.naziv,
    description: truncate(service.kratakOpis || service.dugiOpis || "", 300),
    image: imageUrl,
    // review/aggregateRating live on `provider`, not on this Service node itself.
    // Google's Rich Results validator only renders star-rating snippets for a
    // fixed whitelist of @types (Product, LocalBusiness and its subtypes,
    // Organization, Recipe, Course, ...) - "Service" isn't on that list, even
    // though schema.org's own vocabulary allows `review` on virtually any Thing.
    // HealthAndBeautyBusiness (below) IS a LocalBusiness subtype, so it's
    // eligible - putting the same testimonials there instead is what actually
    // gets them considered for rich results, not just valid-but-inert markup.
    provider: {
      "@type": "HealthAndBeautyBusiness",
      name: siteName,
      ...(aggregateRating ? { aggregateRating } : {}),
      ...(review ? { review } : {}),
    },
    areaServed: "Novi Sad",
    ...(offers ? { offers } : {}),
  };
}

export async function buildServiceSeo(service, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = service.naziv ? `${escape(service.naziv)} | ${siteName}` : siteName;
  const description = truncate(service.kratakOpis || service.dugiOpis || siteConfig.defaultDescription || "");
  const robots = service.isIndexable !== false ? "index, follow" : "noindex, follow";
  const canonical = buildCanonical(req, `/usluge/${service.slug}`);
  const imageUrl = service.slika?.url || service.image?.img || defaultImage;

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Početna", url: buildCanonical(req, "/") },
    { name: "Usluge", url: buildCanonical(req, "/usluge") },
    { name: service.naziv, url: canonical },
  ]);
  const jsonLd = [buildServiceJsonLd(service, canonical, imageUrl, siteName), breadcrumb].filter(Boolean);

  return {
    title,
    description,
    canonical,
    robots,
    jsonLd,
    meta: { keywords: (service.seoKljucneReci || []).join(", ") },
    og: { title, description, url: canonical, type: "website", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}

export default { buildServiceSeo };