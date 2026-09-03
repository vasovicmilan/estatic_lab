import { truncate, escape, buildCanonical, appendPageParam } from "../utils.seo.js";

export async function buildTagSeo(tag, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  const title = tag.name ? `#${escape(tag.name)} | ${siteName}` : siteName;
  const description = truncate(tag.description || siteConfig.defaultDescription || `Sadržaj označen sa "${tag.name}".`);
  // isActive governs whether the tag appears as a filter chip at all; isIndexable is
  // the separate, narrower switch for whether THIS archive page should be indexed -
  // e.g. a tag used on only one item is still a useful label, but its archive page
  // is thin/near-duplicate and better left out of search results.
  const robots = tag.isActive !== false && tag.isIndexable !== false ? "index, follow" : "noindex, follow";

  const basePath =
    tag.domain === "post"
      ? `/blog/tag/${tag.slug}`
      : tag.domain === "product"
      ? `/prodavnica/tag/${tag.slug}`
      : `/usluge/tag/${tag.slug}`;
  const canonical = appendPageParam(buildCanonical(req, basePath), req.query?.page);

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