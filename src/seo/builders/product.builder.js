import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildProductSeo(product, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = product.naziv ? `${escape(product.naziv)} | ${siteName}` : siteName;
  const description = truncate(product.kratakOpis || product.dugiOpis || siteConfig.defaultDescription || "");
  const canonical = buildCanonical(req, `/prodavnica/${product.slug}`);
  const imageUrl = product.slika?.url || defaultImage;

  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    meta: { keywords: (product.seoKljucneReci || []).join(", ") },
    og: { title, description, url: canonical, type: "product", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}