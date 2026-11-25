import * as sitemapService from "../../services/sitemap.service.js";
import * as llmsTxtService from "../../services/llms-txt.service.js";
import { logError } from "../../utils/logger.util.js";
import { FEATURES } from "../../config/features.config.js";
import { createTtlCache } from "../../utils/ttl-cache.util.js";

// sitemap.xml i llms.txt prave desetak upita u bazu pri svakom zahtevu, a menjaju se retko; sitemap je pritom
// izuzet iz Cloudflare geo pravila, pa ga svako može da zove. Rezultat se drži 10 minuta, a istovremeni
// zahtevi dele isti upit (u kešu je obećanje, ne gotov tekst). Neuspeh se ne pamti.
const SEO_CACHE_TTL_MS = 10 * 60 * 1000;
const seoCache = createTtlCache(SEO_CACHE_TTL_MS, 5);

export function cachedSeoText(key, build) {
  let pending = seoCache.get(key);
  if (!pending) {
    pending = Promise.resolve()
      .then(build)
      .catch((error) => {
        seoCache.delete(key);
        throw error;
      });
    seoCache.set(key, pending);
  }
  return pending;
}

export function clearSeoCache() {
  seoCache.clear();
}

// Pure so it can be unit-tested; `features` is FEATURES from features.config.js.
// The booking-flow rule only makes sense when the booking module is on - on a
// shop/blog-only deployment /zakazivanje doesn't exist and listing it would just
// advertise a path that 404s.
export function buildRobotsTxt(base, features = FEATURES) {
  const lines = ["User-agent: *", "Disallow: /admin", "Disallow: /nalog", "Disallow: /moj-nalog", "Disallow: /newsletter/odjava", "Disallow: /uputstva"];
  if (features.booking) {
    // Booking-flow state pages (/zakazivanje/:slug/podaci, /termin, ...) -
    // per-visit availability/form state, not content: infinite crawlable
    // variations via servicePackageId etc., nothing worth indexing, and
    // crawlers were burning real crawl budget on them (~2000 hits/2mo in
    // the access logs, mostly Amazonbot/MJ12bot/Claude-SearchBot).
    lines.push("Disallow: /zakazivanje");
  }
  lines.push("Allow: /", "", `Sitemap: ${base}/sitemap.xml`, "");
  return lines.join("\n");
}

export async function robotsTxt(req, res, next) {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    res.type("text/plain");
    res.send(buildRobotsTxt(base));
  } catch (error) {
    logError("[robotsTxt] Greška pri generisanju robots.txt", error);
    next(error);
  }
}

export async function sitemapXml(req, res, next) {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    const xml = await cachedSeoText(`sitemap:${base}`, async () => {
      const urls = await sitemapService.getSitemapUrls(base);

      const body = urls
        .map((entry) => {
          const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
          const changefreq = entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : "";
          const priority = entry.priority !== undefined ? `\n    <priority>${entry.priority}</priority>` : "";
          return `  <url>\n    <loc>${entry.loc}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
        })
        .join("\n");

      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
    });

    res.set("Cache-Control", "public, max-age=600");
    res.type("application/xml");
    res.send(xml);
  } catch (error) {
    logError("[sitemapXml] Greška pri generisanju sitemap.xml", error);
    next(error);
  }
}

export async function llmsTxt(req, res, next) {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    const content = await cachedSeoText(`llms:${base}`, () => llmsTxtService.generateLlmsTxt(base));
    res.set("Cache-Control", "public, max-age=600");
    res.type("text/markdown");
    res.send(content);
  } catch (error) {
    logError("[llmsTxt] Greška pri generisanju llms.txt", error);
    next(error);
  }
}

export default { robotsTxt, sitemapXml, llmsTxt };