import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildServiceSeo(service, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estatik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = service.naziv ? `${escape(service.naziv)} | ${siteName}` : siteName;
  const description = truncate(service.kratakOpis || service.dugiOpis || siteConfig.defaultDescription || "");
  const robots = service.isIndexable !== false ? "index, follow" : "noindex, follow";
  const canonical = buildCanonical(req, `/usluge/${service.slug}`);
  const imageUrl = service.slika?.url || service.image?.img || defaultImage;

  return {
    title,
    description,
    canonical,
    robots,
    meta: { keywords: (service.seoKljucneReci || []).join(", ") },
    og: { title, description, url: canonical, type: "website", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}
