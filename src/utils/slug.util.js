const DIACRITIC_MAP = {
  č: "c", ć: "c", đ: "dj", š: "s", ž: "z",
  Č: "c", Ć: "c", Đ: "dj", Š: "s", Ž: "z",
};

export function generateSlug(text) {
  if (!text) return "";

  return String(text)
    .split("")
    .map((char) => DIACRITIC_MAP[char] || char)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateUniqueSlug(sourceText, checkExists) {
  const base = generateSlug(sourceText);
  if (!base) throw new Error("Ne mogu da generišem slug iz praznog teksta");

  let candidate = base;
  let suffix = 2;

  while (await checkExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export default { generateSlug, generateUniqueSlug };