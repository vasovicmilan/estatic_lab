import { truncate, escape, buildCanonical, appendPageParam, buildBreadcrumbJsonLd, buildFaqPageJsonLd, collectFaqItemsFromContentBlocks } from "../utils.seo.js";
import { renderContentBlocks } from "../../utils/content-blocks.util.js";

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
  const canonical = appendPageParam(buildCanonical(req, basePath), req.query?.page);

  // category.content is only populated for the handful of categories built out
  // as real landing pages (see category.model.js's comment on that field) - most
  // categories have an empty array here, so both of these are routinely null/[].
  const renderedBlocks = renderContentBlocks(category.content);
  const faqItems = collectFaqItemsFromContentBlocks(renderedBlocks);
  const breadcrumbLabel = category.domain === "post" ? "Blog" : category.domain === "product" ? "Prodavnica" : "Usluge";
  const breadcrumbBase = category.domain === "post" ? "/blog" : category.domain === "product" ? "/prodavnica" : "/usluge";
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Početna", url: buildCanonical(req, "/") },
    { name: breadcrumbLabel, url: buildCanonical(req, breadcrumbBase) },
    { name: category.name, url: canonical },
  ]);
  const jsonLd = [buildFaqPageJsonLd(faqItems), breadcrumb].filter(Boolean);

  return {
    title,
    description,
    canonical,
    robots,
    jsonLd,
    meta: {},
    og: { title, description, url: canonical, type: "website", site_name: siteName },
    twitter: { card: "summary", title, description },
  };
}