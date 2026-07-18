import serviceService from "./service.service.js";
import packageService from "./package.service.js";
import postService from "./post.service.js";
import expertService from "./expert.service.js";
import productService from "./product.service.js";
import { logError } from "../utils/logger.util.js";

const STATIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/o-nama", changefreq: "monthly", priority: "0.6" },
  { path: "/usluge", changefreq: "weekly", priority: "0.8" },
  { path: "/paketi", changefreq: "weekly", priority: "0.8" },
  { path: "/prodavnica", changefreq: "weekly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/nas-tim", changefreq: "monthly", priority: "0.6" },
  { path: "/faq", changefreq: "monthly", priority: "0.4" },
  { path: "/politika-privatnosti", changefreq: "yearly", priority: "0.2" },
  { path: "/uslovi-koriscenja", changefreq: "yearly", priority: "0.2" },
];

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

export async function getSitemapUrls(base) {
  const [services, packages, posts, experts, products] = await Promise.all([
    safeList(async () => (await serviceService.findActiveServices({ page: 1, limit: 500 })).data || [], "usluge"),
    safeList(async () => (await packageService.findActivePackages({ page: 1, limit: 500 })).data || [], "paketi"),
    safeList(async () => (await postService.findPublishedPosts({ page: 1, limit: 500 })).data || [], "blog"),
    safeList(async () => expertService.getActiveExperts(), "eksperti"),
    safeList(async () => (await productService.listPublicProducts({ page: 1, limit: 500 })).data || [], "prodavnica"),
  ]);

  const urls = STATIC_PAGES.map((page) => ({
    loc: `${base}${page.path}`,
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  for (const service of services) {
    if (!service?.slug) continue;
    urls.push({ loc: `${base}/usluge/${service.slug}`, changefreq: "monthly", priority: "0.7" });
  }
  for (const pkg of packages) {
    if (!pkg?.slug) continue;
    urls.push({ loc: `${base}/paketi/${pkg.slug}`, changefreq: "monthly", priority: "0.7" });
  }
  for (const post of posts) {
    if (!post?.slug) continue;
    urls.push({ loc: `${base}/blog/${post.slug}`, changefreq: "monthly", priority: "0.6" });
  }
  for (const expert of experts) {
    if (!expert?.slug) continue;
    urls.push({ loc: `${base}/nas-tim/${expert.slug}`, changefreq: "yearly", priority: "0.5" });
  }
  for (const product of products) {
    if (!product?.slug) continue;
    urls.push({ loc: `${base}/prodavnica/${product.slug}`, changefreq: "weekly", priority: "0.7" });
  }

  return urls;
}

export default { getSitemapUrls };