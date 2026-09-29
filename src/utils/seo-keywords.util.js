/**
 * Izvlači SEO ključne reči iz req.body admin forme.
 *
 * Generička admin forma (admin/_form.ejs) šalje polje `seoKeywordsCsv`
 * (tekst, reči odvojene zarezom), a stariji/posebni view-ovi (npr.
 * admin/post/seo.ejs) šalju `seoKeywords`. Prihvatamo oba oblika - i string i
 * niz - da se ime polja i kontroler ne mogu razići (ranije je SEO forma usluge
 * i proizvoda slala `seoKeywordsCsv`, a kontroler čitao `seoKeywords`, pa bi
 * svako čuvanje obrisalo ključne reči).
 *
 * Vraća niz bez praznih i duplih stavki (redosled prvog pojavljivanja).
 */
export function parseSeoKeywords(body = {}) {
  const raw = body.seoKeywordsCsv !== undefined ? body.seoKeywordsCsv : body.seoKeywords;

  const parts = Array.isArray(raw) ? raw.flatMap((item) => String(item ?? "").split(",")) : String(raw ?? "").split(",");

  const seen = new Set();
  const keywords = [];
  for (const part of parts) {
    const keyword = part.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords;
}

export default { parseSeoKeywords };
