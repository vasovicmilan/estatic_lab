import { truncate, escape, buildCanonical, buildBreadcrumbJsonLd } from "../utils.seo.js";

// One Offer per active variation, carrying each variation's own price/sku/stock -
// this is what lets Google (and price-aware AI answer engines) show real
// availability instead of guessing "in stock" from page text.
function buildProductOffers(product, canonical) {
  const variants = (product.varijante || []).filter((v) => v.aktivna !== false && typeof v.cena === "number");
  if (variants.length === 0) return undefined;
  return variants.map((v) => ({
    "@type": "Offer",
    name: v.naziv,
    ...(v.sku ? { sku: v.sku } : {}),
    url: canonical,
    priceCurrency: "RSD",
    price: v.cena,
    availability: v.naStanju ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  }));
}

function buildProductJsonLd(product, canonical, imageUrl, siteName) {
  const offers = buildProductOffers(product, canonical);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": canonical,
    name: product.naziv,
    description: truncate(product.kratakOpis || product.dugiOpis || "", 300),
    image: imageUrl,
    ...(product.sku ? { sku: product.sku } : {}),
    brand: { "@type": "Brand", name: siteName },
    ...(offers ? { offers } : {}),
  };
}

export async function buildProductSeo(product, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = product.naziv ? `${escape(product.naziv)} | ${siteName}` : siteName;
  const description = truncate(product.kratakOpis || product.dugiOpis || siteConfig.defaultDescription || "");
  const canonical = buildCanonical(req, `/prodavnica/${product.slug}`);
  const imageUrl = product.slika?.url || defaultImage;

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Početna", url: buildCanonical(req, "/") },
    { name: "Prodavnica", url: buildCanonical(req, "/prodavnica") },
    { name: product.naziv, url: canonical },
  ]);
  const jsonLd = [buildProductJsonLd(product, canonical, imageUrl, siteName), breadcrumb].filter(Boolean);

  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    jsonLd,
    meta: { keywords: (product.seoKljucneReci || []).join(", ") },
    og: { title, description, url: canonical, type: "product", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}

export default { buildProductSeo };