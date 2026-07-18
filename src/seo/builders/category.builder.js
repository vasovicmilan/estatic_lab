import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildCategorySeo(category, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const title = category.name ? `${escape(category.name)} | ${siteName}` : siteName;
  const description = truncate(category.shortDescription || category.longDescription || siteConfig.defaultDescription || "");
  const robots = category.meta?.isActive !== false && category.isIndexable !== false ? "index, follow" : "noindex, follow";

  const basePath =
    category.domain === "post"
      ? `/blog/kategorija/${category.slug}`
      : category.domain === "product"
      ? `/prodavnica/kategorija/${category.slug}`
      : `/usluge/kategorija/${category.slug}`;
  const canonical = buildCanonical(req, basePath);

  return {
    title,
    description,
    canonical,
    robots,
    meta: {},
    og: { title, description, url: canonical, type: "website", site_name: siteName },
    twitter: { card: "summary", title, description },
  };
}