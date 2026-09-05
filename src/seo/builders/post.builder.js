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
  const siteName = siteConfig.siteName || "Estetik Lab";
  const defaultImage = siteConfig.defaultImage || "/images/site/default-og.webp";
  const title = post.naslov ? `${escape(post.naslov)} | ${siteName}` : siteName;
  const description = truncate(post.seo?.opis || post.kratakOpis || siteConfig.defaultDescription || "");
  const robots = "index, follow";
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