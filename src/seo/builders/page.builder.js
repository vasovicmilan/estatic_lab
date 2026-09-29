import { escape, buildCanonical, appendPageParam } from "../utils.seo.js";

export async function buildPageSeoWithReq(pageConfig, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estetik Lab";
  // Naslovi iz baze već sadrže "| Estetik Lab"; ne dupliramo sufiks.
  const rawTitle = pageConfig.title ? escape(pageConfig.title) : "";
  const title = rawTitle ? (rawTitle.includes(siteName) ? rawTitle : `${rawTitle} | ${siteName}`) : siteName;
  const description = pageConfig.description || siteConfig.defaultDescription || "";
  const robots = pageConfig.noIndex ? "noindex, follow" : "index, follow";
  const canonical = appendPageParam(buildCanonical(req, pageConfig.slug || "/"), req.query?.page);
  const imageUrl = pageConfig.image || siteConfig.defaultImage || "/images/site/default-og.webp";

  return {
    title,
    description,
    canonical,
    robots,
    meta: {},
    og: { title, description, url: canonical, image: imageUrl, site_name: siteName },
    twitter: { card: "summary", title, description, image: imageUrl },
  };
}