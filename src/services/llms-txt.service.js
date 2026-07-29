import serviceService from "./service.service.js";
import packageService from "./package.service.js";
import postService from "./post.service.js";
import categoryService from "./category.service.js";
import BUSINESS from "../config/business.config.js";
import { logError } from "../utils/logger.util.js";

// llms.txt (https://llmstxt.org) is a plain-markdown index aimed at LLM crawlers
// and answer engines (ChatGPT/Perplexity/Claude-style browsing, Google's AI
// Overviews, etc.) rather than classic search bots - the same role robots.txt/
// sitemap.xml play for traditional crawlers, but written in prose+links an LLM
// can summarize directly instead of a machine-only format. Generated from live
// data (same pattern as sitemap.service.js) rather than hand-maintained, so it
// can't silently go stale as services/packages/posts change.

async function safeList(fn, label) {
  try {
    return await fn();
  } catch (error) {
    logError(`[llmsTxtService] Greška pri učitavanju "${label}" za llms.txt`, error);
    return [];
  }
}

function serviceLine(base, service) {
  const desc = service.kratakOpis ? `: ${service.kratakOpis}` : "";
  return `- [${service.naziv}](${base}/usluge/${service.slug})${desc}`;
}

function packageLine(base, pkg) {
  const desc = pkg.kratakOpis ? `: ${pkg.kratakOpis}` : "";
  return `- [${pkg.naziv}](${base}/paketi/${pkg.slug}) - ${pkg.cena}${desc}`;
}

function postLine(base, post) {
  const desc = post.kratakOpis ? `: ${post.kratakOpis}` : "";
  return `- [${post.naslov}](${base}/blog/${post.slug})${desc}`;
}

function categoryLine(base, path, category) {
  return `- [${category.naziv}](${base}${path}/${category.slug})`;
}

export async function generateLlmsTxt(base) {
  const [servicesResult, packagesResult, postsResult, productCategories] = await Promise.all([
    safeList(() => serviceService.findActiveServices({ page: 1, limit: 100 }), "usluge"),
    safeList(() => packageService.findActivePackages({ page: 1, limit: 50 }), "paketi"),
    safeList(() => postService.findPublishedPosts({ page: 1, limit: 10 }), "blog"),
    safeList(() => categoryService.getPublicCategories("product"), "kategorije prodavnice"),
  ]);

  const services = servicesResult.data || [];
  const packages = packagesResult.data || [];
  const posts = postsResult.data || [];

  const lines = [
    `# ${BUSINESS.name}`,
    "",
    `> ${BUSINESS.legalName} - estetski i wellness centar u Novom Sadu (${BUSINESS.address.addressLocality}, Srbija). Online zakazivanje tretmana, paketi seansi po povoljnijoj ceni, i prodavnica profesionalne kozmetičke opreme i preparata.`,
    "",
    `Kontakt: ${BUSINESS.email} | ${BUSINESS.phone} | ${BUSINESS.address.full}`,
    "",
  ];

  if (services.length > 0) {
    lines.push("## Usluge", "");
    services.forEach((service) => lines.push(serviceLine(base, service)));
    lines.push("", `Sve usluge: ${base}/usluge`, "");
  }

  if (packages.length > 0) {
    lines.push("## Paketi", "");
    packages.forEach((pkg) => lines.push(packageLine(base, pkg)));
    lines.push("", `Svi paketi: ${base}/paketi`, "");
  }

  lines.push("## Prodavnica", "");
  if (productCategories.length > 0) {
    productCategories.forEach((category) => lines.push(categoryLine(base, "/prodavnica/kategorija", category)));
    lines.push("");
  }
  lines.push(`Ceo katalog: ${base}/prodavnica`, "");

  if (posts.length > 0) {
    lines.push("## Blog", "");
    posts.forEach((post) => lines.push(postLine(base, post)));
    lines.push("", `Svi članci: ${base}/blog`, "");
  }

  lines.push(
    "## Ostalo",
    "",
    `- [O nama](${base}/o-nama)`,
    `- [Naš tim](${base}/nas-tim)`,
    `- [Kontakt](${base}/kontakt)`,
    `- [FAQ](${base}/faq)`,
    `- [Mapa sajta (sitemap.xml)](${base}/sitemap.xml)`,
    ""
  );

  return lines.join("\n");
}

export default { generateLlmsTxt };