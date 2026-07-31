import { truncate, escape, buildCanonical, buildBreadcrumbJsonLd, buildAggregateRatingJsonLd, buildReviewJsonLd } from "../utils.seo.js";

// pkg.faq comes from the mapper as {pitanje, odgovor} pairs (Serbian field names
// used throughout the public-facing mapped shape). Normalized here to
// {question, answer} so the FAQPage shape matches post.builder.js's version -
// keeps the two easy to unify into one shared helper later if it's worth it.
function normalizeFaqItems(faq = []) {
  return faq.map((item) => ({ question: item.pitanje, answer: item.odgovor })).filter((item) => item.question && item.answer);
}

function buildFaqPageJsonLd(faqItems) {
  if (faqItems.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

// A package is a fixed bundle of sessions sold at a fixed price, which maps
// cleanly onto schema.org/Product + Offer - this is what lets Google (and
// price-aware AI answer engines) surface the price directly instead of having
// to infer it from page text.
function buildProductJsonLd(pkg, canonical, imageUrl, siteName) {
  const aggregateRating = buildAggregateRatingJsonLd(pkg.ratingSummary);
  const review = buildReviewJsonLd(pkg.recenzije);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": canonical,
    name: pkg.naziv,
    description: truncate(pkg.kratakOpis || pkg.opis || "", 300),
    image: imageUrl,
    brand: { "@type": "Brand", name: siteName },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "RSD",
      price: pkg.cena,
      availability: "https://schema.org/InStock",
    },
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(review ? { review } : {}),
  };
}

export async function buildPackageSeo(pkg, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = pkg.naziv ? `${escape(pkg.naziv)} | ${siteName}` : siteName;
  const description = truncate(pkg.kratakOpis || pkg.opis || siteConfig.defaultDescription || "");
  const canonical = buildCanonical(req, `/paketi/${pkg.slug}`);
  const imageUrl = pkg.slika?.url || defaultImage;

  const faqItems = normalizeFaqItems(pkg.faq);
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Početna", url: buildCanonical(req, "/") },
    { name: "Paketi", url: buildCanonical(req, "/paketi") },
    { name: pkg.naziv, url: canonical },
  ]);
  const jsonLd = [buildProductJsonLd(pkg, canonical, imageUrl, siteName), buildFaqPageJsonLd(faqItems), breadcrumb].filter(Boolean);

  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    jsonLd,
    meta: { keywords: (pkg.seoKljucneReci || []).join(", ") },
    og: { title, description, url: canonical, type: "product", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}

export default { buildPackageSeo };