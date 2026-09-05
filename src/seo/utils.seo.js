export function truncate(text, max = 160) {
  if (!text) return "";
  const plain = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return plain.slice(0, max - 3) + "...";
}

export function escape(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, (m) => {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

export function buildCanonical(req, path) {
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

// Appends ?page=N to a canonical URL when on page 2+ of a paginated listing -
// self-referencing canonicals per page (Google's current pagination guidance)
// rather than always pointing every paginated page back to page 1, which
// suppresses page 2+ from being crawled/indexed as real, distinct results.
// page=1 (explicit or implicit) is treated identically, so /usluge?page=1
// canonicalizes to the same clean URL as /usluge.
export function appendPageParam(canonical, page) {
  const pageNum = parseInt(page, 10);
  if (!pageNum || pageNum <= 1) return canonical;
  const separator = canonical.includes("?") ? "&" : "?";
  return `${canonical}${separator}page=${pageNum}`;
}

// Homepage-only (Google's own guidance: this should appear once, on the site's
// root page, not on every page like the Organization schema). Tells Google the
// real search endpoint behind the blog search box, which can unlock a sitelinks
// searchbox directly in Google's results for a branded query.
export function buildWebsiteJsonLd(req) {
  const base = buildCanonical(req, "/");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}blog/pretraga?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

// Shared across every entity builder (service/product/package/post) so breadcrumb
// shape stays identical site-wide. Items without both name+url are dropped rather
// than rendered with a gap, since a broken ListItem is worse than a shorter trail.
export function buildBreadcrumbJsonLd(items = []) {
  const valid = items.filter((item) => item?.name && item?.url);
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: valid.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Shared across every listing page (services/packages/shop/blog + their category
// and tag archives) - describes the current page's actual rendered results, not
// the entire catalog, so a filtered/paginated view's markup always matches what's
// visible. Callers pass {name, path} pairs already resolved from that page's
// result set; this only handles the URL absolutization and ListItem shape.
export function buildItemListJsonLd(req, items = []) {
  const valid = items.filter((item) => item?.name && item?.path);
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: valid.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: buildCanonical(req, item.path),
    })),
  };
}

// AggregateRating is computed over ALL approved reviews for the entity (see
// testimonial.repository.js's getRatingSummary), not just the handful shown on
// the page - reviewCount must reflect the true total per Google's structured data
// guidelines. Returns null (field omitted) when there are zero approved reviews
// yet, rather than fabricating a 0-review rating block.
export function buildAggregateRatingJsonLd(ratingSummary) {
  if (!ratingSummary || !ratingSummary.count) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: Math.round(ratingSummary.average * 10) / 10,
    reviewCount: ratingSummary.count,
    bestRating: 5,
    worstRating: 1,
  };
}

// Reviews here are the same testimonials already rendered visibly on the page
// (same mapped {ime, ocena, komentar} shape from mapTestimonialForPublic) - the
// markup always matches what a visitor and Google both actually see, never a
// separate/larger sample that isn't shown.
export function buildReviewJsonLd(testimonials = []) {
  const valid = testimonials.filter((t) => t?.ocena && t?.komentar);
  if (valid.length === 0) return null;
  return valid.map((t) => ({
    "@type": "Review",
    author: { "@type": "Person", name: t.ime || "Anoniman" },
    reviewRating: { "@type": "Rating", ratingValue: t.ocena, bestRating: 5, worstRating: 1 },
    reviewBody: truncate(t.komentar, 300),
  }));
}

// Shared by every builder that can show FAQ rich results: post (content-block
// faq), category (content-block faq, same shape - see collectFaqItemsFromContentBlocks
// below), service and product (their own faq: [FAQSchema] array, mapped to
// {pitanje, odgovor} - see service.mapper.js / product.mapper.js). Accepts
// either {question, answer} or {pitanje, odgovor} per item so callers don't
// each need their own translation step just to reach this function.
export function buildFaqPageJsonLd(faqItems = []) {
  const valid = (faqItems || [])
    .map((item) => ({ question: item?.question || item?.pitanje, answer: item?.answer || item?.odgovor }))
    .filter((item) => item.question && item.answer);
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: valid.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

// Pulls every faq block's Q&A pairs out of a rendered content-block array (the
// Serbian-labeled shape from utils/content-blocks.util.js's renderContentBlocks -
// block.tip === "faq", block.faqStavke). A page can have more than one faq
// block (rare, but the schema allows it) - Google's FAQPage rich result wants
// one consolidated list per page, not one schema block per content block.
export function collectFaqItemsFromContentBlocks(blocks = []) {
  return (blocks || [])
    .filter((block) => block.tip === "faq" && Array.isArray(block.faqStavke))
    .flatMap((block) => block.faqStavke)
    .filter((item) => item?.question && item?.answer);
}