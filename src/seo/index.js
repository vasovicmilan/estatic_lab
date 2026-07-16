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
 *
 * NOTE: now also returns a `twitter` block and richer `og` (site_name/image) so static
 * pages (home, about, faq, etc.) get the same OG/Twitter coverage entity pages already have.
 */
export function buildPageSeo({ title, description, canonical, isIndexable = true, type = "website", image, siteName = "Estatic Lab" } = {}) {
  const pageTitle = title || siteName;
  const pageDescription = description || "";
  const ogImage = image || "/images/site/default-og.webp";

  return {
    pageTitle,
    pageDescription,
    canonical: canonical || "/",
    robots: isIndexable ? "index, follow" : "noindex, follow",
    og: {
      title: pageTitle,
      description: pageDescription,
      type,
      url: canonical || "/",
      site_name: siteName,
      image: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      image: ogImage,
    },
  };
}

export default { generateSeo, buildPageSeo };