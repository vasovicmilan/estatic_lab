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