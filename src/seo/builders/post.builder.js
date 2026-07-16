import { truncate, escape, buildCanonical } from "../utils.seo.js";

export async function buildPostSeo(post, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || "Estatic Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = post.naslov ? `${escape(post.naslov)} | ${siteName}` : siteName;
  const description = truncate(post.seo?.opis || post.kratakOpis || siteConfig.defaultDescription || "");
  const robots = "index, follow";
  const canonical = buildCanonical(req, `/blog/${post.slug}`);
  const imageUrl = post.slika?.url || post.coverImage?.img || defaultImage;

  return {
    title,
    description,
    canonical,
    robots,
    meta: { keywords: (post.seoKljucneReci || post.seo?.kljucneReci || []).join(", ") },
    og: {
      title,
      description,
      url: canonical,
      type: "article",
      image: imageUrl,
      site_name: siteName,
      article: {
        publishedTime: post.datumObjave,
        author: post.autor?.ime,
        section: post.kategorije?.[0],
      },
    },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}
