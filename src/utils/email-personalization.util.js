// {{ime}} / {{ime|rezervna reč}} placeholders for newsletter campaigns.
//
//   "Zdravo {{ime}}, ..."            + name "Ana"  -> "Zdravo Ana, ..."
//   "Zdravo {{ime}}, ..."            + no name     -> "Zdravo, ..."   (the token AND the space before it go)
//   "Zdravo {{ime|prijatelju}}, ..." + no name     -> "Zdravo prijatelju, ..."
//
// A subscriber who only signed up in the footer has an email and nothing else, so every
// campaign has to read fine without a name too.

const TOKEN = /(\s?)\{\{\s*ime\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi;

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} text
 * @param {string|null|undefined} firstName
 * @param {{ html?: boolean }} [options] html = true when `text` is HTML (the name is escaped then)
 */
export function personalizeText(text, firstName, { html = false } = {}) {
  if (!text || typeof text !== "string" || !text.includes("{{")) return text;
  const name = typeof firstName === "string" ? firstName.trim() : "";
  const encode = (value) => (html ? escapeHtml(value) : value);

  return text.replace(TOKEN, (_match, space, fallback) => {
    const value = name || (fallback ? fallback.trim() : "");
    return value ? `${space}${encode(value)}` : "";
  });
}

export default { personalizeText };
