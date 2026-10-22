import { BUSINESS } from "../../config/business.config.js";
import { truncate, escape, buildCanonical, buildBreadcrumbJsonLd, buildFaqPageJsonLd, collectFaqItemsFromContentBlocks } from "../utils.seo.js";


function buildBlogPostingJsonLd(post, canonical, imageUrl, siteName) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": canonical,
    headline: post.naslov,
    description: truncate(post.kratakOpis || "", 300),
    image: imageUrl,
    datePublished: post.datumObjaveISO || undefined,
    dateModified: post.poslednjeAzuriranjeISO || post.datumObjaveISO || undefined,
    author: post.autor?.ime ? { "@type": "Person", name: post.autor.ime } : { "@type": "Organization", name: siteName },
    publisher: { "@type": "Organization", name: siteName },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
}

export async function buildPostSeo(post, req, siteConfig = {}) {
  const siteName = siteConfig.siteName || BUSINESS.name;
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  // SEO naslov iz baze ima prednost; ako već sadrži ime sajta, ne dupliramo sufiks.
  const rawTitle = post.seo?.naslov || post.naslov;
  const title = rawTitle ? (rawTitle.includes(siteName) ? escape(rawTitle) : `${escape(rawTitle)} | ${siteName}`) : siteName;
  const description = truncate(post.seo?.opis || post.kratakOpis || siteConfig.defaultDescription || "");
  const robots = post.isIndexable !== false ? "index, follow" : "noindex, follow";
  const canonical = buildCanonical(req, `/blog/${post.slug}`);
  const imageUrl = post.slika?.url || post.coverImage?.img || defaultImage;

  const faqItems = collectFaqItemsFromContentBlocks(post.sadrzaj);
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Početna", url: buildCanonical(req, "/") },
    { name: "Blog", url: buildCanonical(req, "/blog") },
    { name: post.naslov, url: canonical },
  ]);
  const jsonLd = [buildBlogPostingJsonLd(post, canonical, imageUrl, siteName), buildFaqPageJsonLd(faqItems), breadcrumb].filter(Boolean);

  return {
    title,
    description,
    canonical,
    robots,
    jsonLd,
    meta: { keywords: (post.seoKljucneReci || post.seo?.kljucneReci || []).join(", ") },
    og: {
      title,
      description,
      url: canonical,
      type: "article",
      image: imageUrl,
      site_name: siteName,
      article: {
        publishedTime: post.datumObjaveISO || post.datumObjave,
        author: post.autor?.ime,
        section: post.kategorije?.[0],
      },
    },
    twitter: { card: "summary_large_image", title, description, image: imageUrl },
  };
}