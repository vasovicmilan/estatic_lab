import { buildServiceSeo } from "./builders/service.builder.js";
import { buildPostSeo } from "./builders/post.builder.js";
import { buildCategorySeo } from "./builders/category.builder.js";
import { buildTagSeo } from "./builders/tag.builder.js";
import { buildExpertSeo } from "./builders/expert.builder.js";
import { buildPageSeoWithReq } from "./builders/page.builder.js";

const builders = {
  service: buildServiceSeo,
  post: buildPostSeo,
  category: buildCategorySeo,
  tag: buildTagSeo,
  expert: buildExpertSeo,
  page: buildPageSeoWithReq,
};

/**
 * Entity-rich SEO (proper canonical host, OG/Twitter tags, per-type fields). Needs `req`
 * for the canonical URL, so this is called directly from controllers — not from
 * services, to keep the service layer free of framework request objects.
 *
 * Usage: const seo = await generateSeo("service", mappedService, req);
 */
export async function generateSeo(type, source, req, siteConfig = {}) {
  const builder = builders[type];
  if (!builder) throw new Error(`Nepoznat SEO tip: ${type}`);
  return builder(source, req, siteConfig);
}

/**
 * Simple relative-URL SEO for static/informational pages and homepage aggregation —
 * no `req` needed, safe to call from the service layer (index.service.js, blog.service.js
 * already use this for their `seo` field). Kept separate from `generateSeo` rather than
 * unified, since forcing every static-page service call to thread `req` through for no
 * real benefit (no rich OG data on an About page) isn't worth the churn.
 */
export function buildPageSeo({ title, description, canonical, isIndexable = true, type = "website" } = {}) {
  return {
    pageTitle: title || "Estatic Lab",
    pageDescription: description || "",
    canonical: canonical || "/",
    robots: isIndexable ? "index, follow" : "noindex, follow",
    og: { title: title || "Estatic Lab", description: description || "", type, url: canonical || "/" },
  };
}

export default { generateSeo, buildPageSeo };
