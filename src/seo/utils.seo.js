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