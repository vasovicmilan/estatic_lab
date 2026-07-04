import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildTagSeo(tag, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estatic Lab";
  const title = tag.name ? `#${escape(tag.name)} | ${siteName}` : siteName;
  const description = truncate(siteConfig.defaultDescription || `Sadržaj označen sa "${tag.name}".`);
  const robots = tag.isActive !== false ? "index, follow" : "noindex, follow";

  const basePath = tag.domain === "post" ? `/blog/tag/${tag.slug}` : `/usluge/tag/${tag.slug}`;
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
