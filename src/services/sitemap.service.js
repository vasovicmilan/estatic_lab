import serviceService from "./service.service.js";
import packageService from "./package.service.js";
import postService from "./post.service.js";
import expertService from "./expert.service.js";
import productService from "./product.service.js";
import categoryService from "./category.service.js";
import tagService from "./tag.service.js";
import businessPartnerService from "./business-partner.service.js";
import { FEATURES } from "../config/features.config.js";
import { logError } from "../utils/logger.util.js";

const STATIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/o-nama", changefreq: "monthly", priority: "0.6" },
  { path: "/usluge", changefreq: "weekly", priority: "0.8", feature: "booking" },
  { path: "/paketi", changefreq: "weekly", priority: "0.8", feature: "booking" },
  { path: "/prodavnica", changefreq: "weekly", priority: "0.8", feature: "shop" },
  { path: "/blog", changefreq: "weekly", priority: "0.7", feature: "blog" },
  { path: "/nas-tim", changefreq: "monthly", priority: "0.6" },
  { path: "/saradnici", changefreq: "monthly", priority: "0.5" },
  { path: "/kontakt", changefreq: "monthly", priority: "0.6" },
  { path: "/faq", changefreq: "monthly", priority: "0.4" },
  { path: "/politika-privatnosti", changefreq: "yearly", priority: "0.2" },
  { path: "/uslovi-koriscenja", changefreq: "yearly", priority: "0.2" },
];

// Category/tag archive pages don't carry a per-item "last changed" date the way
// entity pages do (adding/removing a product from a category doesn't touch the
// category document itself), so these are listed without <lastmod> rather than
// stamping them with a fabricated one.
const CATEGORY_PATH_BY_DOMAIN = {
  post: (slug) => `/blog/kategorija/${slug}`,
  product: (slug) => `/prodavnica/kategorija/${slug}`,
  service: (slug) => `/usluge/kategorija/${slug}`,
};
const TAG_PATH_BY_DOMAIN = {
  post: (slug) => `/blog/tag/${slug}`,
  product: (slug) => `/prodavnica/tag/${slug}`,
  service: (slug) => `/usluge/tag/${slug}`,
};
const TAXONOMY_DOMAINS = ["post", "service", "product"];
const TAXONOMY_DOMAIN_FEATURE = { post: "blog", service: "booking", product: "shop" };

// Each data source is fetched defensively - if one repository call fails, the
// rest of the sitemap should still render instead of a 500 on the whole file.
async function safeList(fn, label) {
  try {
    return await fn();
  } catch (error) {
    logError(`[sitemapService] Greška pri učitavanju "${label}" za sitemap`, error);
    return [];
  }
}

function toIso(date) {
  return date ? new Date(date).toISOString() : undefined;
}

export async function getSitemapUrls(base) {
  // Same reasoning as index.service.js's getLandingPageData - a disabled
  // module's URLs are skipped here rather than fetched and left in, so
  // leftover data from a module that was later turned off (e.g. a client who
  // used to sell products) can't leave 404-ing sitemap entries behind, since
  // those routes now correctly 404 via requireModule() (see docs/*/16).
  // categoriesByDomain/tagsByDomain stay indexed against the FULL
  // TAXONOMY_DOMAINS array below (not a filtered one) - a disabled domain
  // just resolves to an empty array at its same index, keeping the
  // `TAXONOMY_DOMAINS.forEach((domain, index) => ...)` correspondence intact.
  const [services, packages, posts, experts, products, partners, categoriesByDomain, tagsByDomain] = await Promise.all([
    FEATURES.booking ? safeList(() => serviceService.listSlugsForSitemap(), "usluge") : Promise.resolve([]),
    FEATURES.booking ? safeList(() => packageService.listSlugsForSitemap(), "paketi") : Promise.resolve([]),
    FEATURES.blog ? safeList(() => postService.listSlugsForSitemap(), "blog") : Promise.resolve([]),
    safeList(() => expertService.listSlugsForSitemap(), "eksperti"),
    FEATURES.shop ? safeList(() => productService.listSlugsForSitemap(), "prodavnica") : Promise.resolve([]),
    safeList(() => businessPartnerService.listSlugsForSitemap(), "saradnici"),
    Promise.all(
      TAXONOMY_DOMAINS.map((domain) =>
        FEATURES[TAXONOMY_DOMAIN_FEATURE[domain]] ? safeList(() => categoryService.getPublicCategories(domain), `kategorije (${domain})`) : Promise.resolve([])
      )
    ),
    Promise.all(
      TAXONOMY_DOMAINS.map((domain) =>
        FEATURES[TAXONOMY_DOMAIN_FEATURE[domain]] ? safeList(() => tagService.getPublicTags(domain), `tagovi (${domain})`) : Promise.resolve([])
      )
    ),
  ]);

  const urls = STATIC_PAGES.filter((page) => !page.feature || FEATURES[page.feature]).map((page) => ({
    loc: `${base}${page.path}`,
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  for (const service of services) {
    if (!service?.slug) continue;
    urls.push({ loc: `${base}/usluge/${service.slug}`, changefreq: "monthly", priority: "0.7", lastmod: toIso(service.updatedAt) });
  }
  for (const pkg of packages) {
    if (!pkg?.slug) continue;
    urls.push({ loc: `${base}/paketi/${pkg.slug}`, changefreq: "monthly", priority: "0.7", lastmod: toIso(pkg.updatedAt) });
  }
  for (const post of posts) {
    if (!post?.slug) continue;
    urls.push({ loc: `${base}/blog/${post.slug}`, changefreq: "monthly", priority: "0.6", lastmod: toIso(post.updatedAt) });
  }
  for (const expert of experts) {
    if (!expert?.slug) continue;
    urls.push({ loc: `${base}/nas-tim/${expert.slug}`, changefreq: "yearly", priority: "0.5", lastmod: toIso(expert.updatedAt) });
  }
  for (const product of products) {
    if (!product?.slug) continue;
    urls.push({ loc: `${base}/prodavnica/${product.slug}`, changefreq: "weekly", priority: "0.7", lastmod: toIso(product.updatedAt) });
  }
  for (const partner of partners) {
    if (!partner?.slug) continue;
    urls.push({ loc: `${base}/saradnici/${partner.slug}`, changefreq: "monthly", priority: "0.5", lastmod: toIso(partner.updatedAt) });
  }

  TAXONOMY_DOMAINS.forEach((domain, index) => {
    for (const category of categoriesByDomain[index]) {
      if (!category?.slug) continue;
      urls.push({ loc: `${base}${CATEGORY_PATH_BY_DOMAIN[domain](category.slug)}`, changefreq: "weekly", priority: "0.5" });
    }
    for (const tag of tagsByDomain[index]) {
      if (!tag?.slug) continue;
      urls.push({ loc: `${base}${TAG_PATH_BY_DOMAIN[domain](tag.slug)}`, changefreq: "weekly", priority: "0.4" });
    }
  });

  return urls;
}

export default { getSitemapUrls };