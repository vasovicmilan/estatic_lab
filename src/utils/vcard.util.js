// vCard 3.0 (.vcf) - "Sačuvaj kontakt" sa javne vizitke. Radi na iOS i Androidu.

function escapeValue(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,");
}

// RFC 6350: linije se dele na ~75 bajtova, nastavak počinje razmakom
function foldLine(line) {
  const chunks = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut -= 1;
    chunks.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** { name, title, org, phone, email, url, note } -> vCard tekst (CRLF). Prazna polja se izostavljaju. */
export function buildVCard({ name, title, org, phone, email, url, note }) {
  const { first, last } = splitName(name);
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escapeValue(last)};${escapeValue(first)};;;`, `FN:${escapeValue(name)}`];
  if (org) lines.push(`ORG:${escapeValue(org)}`);
  if (title) lines.push(`TITLE:${escapeValue(title)}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${escapeValue(phone)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(email)}`);
  if (url) lines.push(`URL:${url}`);
  if (note) lines.push(`NOTE:${escapeValue(note)}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export default { buildVCard, splitName };
