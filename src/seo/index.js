import { buildServiceSeo } from "./builders/service.builder.js";
import { buildPostSeo } from "./builders/post.builder.js";
import { buildCategorySeo } from "./builders/category.builder.js";
import { buildTagSeo } from "./builders/tag.builder.js";
import { buildExpertSeo } from "./builders/expert.builder.js";
import { buildPageSeoWithReq } from "./builders/page.builder.js";
import { buildProductSeo } from "./builders/product.builder.js";
import { buildPackageSeo } from "./builders/package.builder.js";
import { BUSINESS } from "../config/business.config.js";

const builders = {
  service: buildServiceSeo,
  post: buildPostSeo,
  category: buildCategorySeo,
  tag: buildTagSeo,
  expert: buildExpertSeo,
  page: buildPageSeoWithReq,
  product: buildProductSeo,
  package: buildPackageSeo,
};

/**
 * Entity-rich SEO (proper canonical host, OG/Twitter tags, per-type fields). Needs `req`
 * for the canonical URL, so this is called directly from controllers - not from
 * services, to keep the service layer free of framework request objects.
 *
 * Usage: const seo = await generateSeo("service", mappedService, req);
 */
export async function generateSeo(type, source, req, siteConfig = {}) {
  const builder = builders[type];
  if (!builder) throw new Error(`Nepoznat SEO tip: ${type}`);
  return builder(source, req, siteConfig);
}

// Static/informational pages (home, about, FAQ, etc.) are rendered from the service
// layer, which has no `req` to build an absolute URL from the way buildCanonical()
// does for entity pages - so this reads BUSINESS.siteUrl directly instead. IMPORTANT:
// this was previously missing entirely, which is why canonical/og:url on every static
// page rendered as a bare relative path ("/", "/o-nama", ...) instead of a real URL.
//
// BUG FIX: this used to fall back to "https://beautymedica.rs" (no www) whenever
// BASE_URL wasn't set in the environment, while buildCanonical(req, path) below
// (used for entity pages: usluge/paketi/prodavnica/blog post) builds its base from
// req.protocol + req.get("host") - i.e. whatever host the visitor actually used.
// Result: static pages (home, /o-nama, /kontakt, /saradnici, /blog listing)
// canonicalized to the bare apex domain while catalog/detail pages canonicalized
// to www, whichever a given visitor happened to hit. Now both paths agree on the
// same single source of truth (business.config.js's siteUrl, defaulting to www).
const BASE_URL = BUSINESS.siteUrl;

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return BASE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${BASE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/**
 * Simple SEO for static/informational pages and homepage aggregation - no `req`
 * needed, safe to call from the service layer (index.service.js, blog.service.js
 * already use this for their `seo` field). Kept separate from `generateSeo` rather than
 * unified, since forcing every static-page service call to thread `req` through for no
 * real benefit (no rich OG data on an About page) isn't worth the churn.
 *
 * NOTE: canonical/og.url/twitter.image are now resolved to absolute URLs via BASE_URL
 * - previously these were passed straight through as relative paths, which produced
 * an invalid canonical tag and OG/Twitter tags social platforms can't resolve at all.
 */
export function buildPageSeo({ title, description, canonical, isIndexable = true, type = "website", image, siteName = "Estetik Lab" } = {}) {
  const pageTitle = title || siteName;
  const pageDescription = description || "";
  const absoluteCanonical = toAbsoluteUrl(canonical || "/");
  const absoluteImage = toAbsoluteUrl(image || "/images/site/default-og.webp");

  return {
    pageTitle,
    pageDescription,
    canonical: absoluteCanonical,
    robots: isIndexable ? "index, follow" : "noindex, follow",
    og: {
      title: pageTitle,
      description: pageDescription,
      type,
      url: absoluteCanonical,
      site_name: siteName,
      image: absoluteImage,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      image: absoluteImage,
    },
  };
}

export default { generateSeo, buildPageSeo };