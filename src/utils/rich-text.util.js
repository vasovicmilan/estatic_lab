import { escapeHtml, safeHref } from "./html.util.js";

// Admin-editable site content (About, privacy policy, terms, partnership program,
// home intro, ...) is stored as plain strings that may carry a little inline
// markup - <strong>, <a href="/prodavnica"> - and is printed unescaped by the
// legal-content / partnership templates. The stored text is therefore never
// trusted at the point of output: it goes through sanitizeRichText(), which
// REBUILDS the markup from an allowlist instead of trying to strip bad parts.
//
//  - allowed tags are re-emitted from scratch (the original attribute text is
//    never copied through), so there is no way to smuggle in on* handlers,
//    style, srcdoc, etc.
//  - <a> keeps only an href that passes safeHref() (http(s) or root-relative) or
//    a simple mailto:/tel: link
//  - every other tag is dropped (its inner text stays, as plain text), and a "<"
//    that is not part of a tag becomes &lt;

const VOID_TAGS = new Set(["br"]);
const ALLOWED_TAGS = new Set(["strong", "b", "em", "i", "u", "br", "p", "ul", "ol", "li", "a"]);

const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>/g;
const HREF_PATTERN = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const MAIL_OR_TEL = /^(?:mailto:|tel:)[^\s"'<>]+$/i;

function resolveHref(attributes) {
  const match = HREF_PATTERN.exec(attributes || "");
  if (!match) return "";
  const raw = (match[1] ?? match[2] ?? "").trim();
  if (MAIL_OR_TEL.test(raw)) return raw;
  return safeHref(raw);
}

function escapeStrayAngles(text) {
  return text.replace(/</g, "&lt;");
}

export function sanitizeRichText(input) {
  if (input === null || input === undefined) return "";
  const source = String(input);
  const openTags = [];
  let output = "";
  let lastIndex = 0;

  TAG_PATTERN.lastIndex = 0;
  let match;
  while ((match = TAG_PATTERN.exec(source)) !== null) {
    output += escapeStrayAngles(source.slice(lastIndex, match.index));
    lastIndex = TAG_PATTERN.lastIndex;

    const isClosing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      const position = openTags.lastIndexOf(tag);
      if (position === -1) continue; // closer without an opener - drop it
      while (openTags.length > position) {
        output += `</${openTags.pop()}>`;
      }
      continue;
    }

    if (VOID_TAGS.has(tag)) {
      output += `<${tag}>`;
      continue;
    }

    if (tag === "a") {
      const href = resolveHref(match[3]);
      const external = /^https?:/i.test(href);
      output += href ? `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>` : "<a>";
    } else {
      output += `<${tag}>`;
    }
    openTags.push(tag);
  }

  output += escapeStrayAngles(source.slice(lastIndex));
  while (openTags.length > 0) {
    output += `</${openTags.pop()}>`;
  }
  return output;
}

export default sanitizeRichText;
