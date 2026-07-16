import * as sitemapService from "../../services/sitemap.service.js";
import { logError } from "../../utils/logger.util.js";

export async function robotsTxt(req, res, next) {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    res.type("text/plain");
    res.send(
      [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /nalog",
        "Disallow: /moj-nalog",
        "Disallow: /newsletter/odjava",
        "Allow: /",
        "",
        `Sitemap: ${base}/sitemap.xml`,
        "",
      ].join("\n")
    );
  } catch (error) {
    logError("[robotsTxt] Greška pri generisanju robots.txt", error);
    next(error);
  }
}

export async function sitemapXml(req, res, next) {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    const urls = await sitemapService.getSitemapUrls(base);

    const body = urls
      .map((entry) => {
        const changefreq = entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : "";
        const priority = entry.priority !== undefined ? `\n    <priority>${entry.priority}</priority>` : "";
        return `  <url>\n    <loc>${entry.loc}</loc>${changefreq}${priority}\n  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error) {
    logError("[sitemapXml] Greška pri generisanju sitemap.xml", error);
    next(error);
  }
}

export default { robotsTxt, sitemapXml };