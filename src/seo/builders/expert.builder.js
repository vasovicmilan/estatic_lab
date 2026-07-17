import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildExpertSeo(expert, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const fullName = expert.imePrezime || `${expert.firstName || ""} ${expert.lastName || ""}`.trim();
  const title = fullName ? `${escape(fullName)} | ${siteName}` : siteName;
  const description = truncate(expert.kratkaBiografija || expert.shortBio || siteConfig.defaultDescription || "");
  const robots = expert.isActive !== false ? "index, follow" : "noindex, follow";
  const canonical = buildCanonical(req, `/nas-tim/${expert.slug}`);
  const imageUrl = expert.slika?.url || expert.image?.img || defaultImage;

  return {
    title,
    description,
    canonical,
    robots,
    meta: {},
    og: { title, description, url: canonical, type: "profile", image: imageUrl, site_name: siteName },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}
