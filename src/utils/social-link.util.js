// Normalizacija linkova sa vizitke: prihvata "@nalog", "instagram.com/nalog" ili pun URL;
// vraća samo http(s) adresu ili null (javascript:, data: i slično se nikad ne čuvaju).

const HOSTS = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
};

export function normalizeSocialLink(kind, raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;

  let url = value;
  if (!/^https?:\/\//i.test(value)) {
    if (HOSTS[kind] && /^@?[\w.]+$/.test(value)) url = HOSTS[kind] + value.replace(/^@/, "");
    else url = `https://${value.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) return null;
    return parsed.toString().slice(0, 200);
  } catch {
    return null;
  }
}

export default { normalizeSocialLink };
