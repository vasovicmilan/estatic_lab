// Small, dependency-free helpers for the few places where HTML or JSON has to be
// built by hand (admin detail presenters that return markup, <script> blocks that
// embed JSON, user-editable rich text). Everything else in the views goes through
// EJS's own <%= %> escaping and never needs these.

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes text for use as HTML content or inside a quoted attribute value.
 * null/undefined become an empty string; everything else is stringified first.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * JSON.stringify for embedding inside a <script> element (including
 * <script type="application/ld+json">). Plain JSON.stringify leaves "<" alone,
 * so a string containing "</script>" would close the element early and let the
 * rest run as markup. Escaping "<", ">", "&" and the two JS line separators as
 * \uXXXX keeps the output valid JSON/JS with the exact same value when parsed.
 */
export function jsonForScript(value) {
  const json = JSON.stringify(value === undefined ? null : value);
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Returns the URL unchanged if it is an absolute http(s) URL or a root-relative
 * path ("/x", but not protocol-relative "//host"), otherwise "". Meant for hrefs
 * and srcs that end up in hand-built markup.
 */
export function safeHref(url) {
  if (typeof url !== "string") return "";
  const value = url.trim();
  if (!value) return "";
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

/**
 * Only accepts a same-site, root-relative path for post-login style redirects.
 * Anything else (absolute URL, "//host", "/\host", "javascript:", empty) falls
 * back to `fallback`. Backslashes and control characters are rejected because
 * browsers normalise "/\evil.com" to "//evil.com".
 */
export function safeRedirectPath(target, fallback = "/") {
  if (typeof target !== "string") return fallback;
  const value = target.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

/**
 * Builds an <img> tag for hand-assembled admin markup (details pages), with the
 * URL and alt text escaped. `width` and `className` come from the presenter, not
 * from user data.
 */
export function renderImage(url, alt, { width, className } = {}) {
  const widthAttr = Number.isFinite(width) ? ` width="${width}"` : "";
  const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt || "")}"${widthAttr}${classAttr}>`;
}
