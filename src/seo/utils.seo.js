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