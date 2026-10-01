import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// FEATURES / BUSINESS se računaju pri učitavanju modula iz env-a, zato svaki scenario ide u
// poseban proces sa svojim ENABLED_MODULES / WHITE_LABEL.
function run(env, script) {
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, WHITE_LABEL: "", ENABLED_MODULES: "", SITE_NAME: "", BASE_URL: "", ...env },
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout.trim().split("\n").pop());
}

const SEED = `
import { buildInitialSiteContent } from "./src/config/site-content-seed.js";
import { BUSINESS } from "./src/config/business.config.js";
import siteContent, { adaptHeroToModules } from "./src/services/site-content.service.js";
const seed = buildInitialSiteContent();
console.log(JSON.stringify({
  seedKeys: Object.keys(seed),
  business: BUSINESS,
  hero: seed.homeHero,
  adapted: adaptHeroToModules({ ctaLabel: "Zakažite termin", ctaUrl: "/usluge", secondaryCtaLabel: "Pogledajte pakete", secondaryCtaUrl: "/paketi" }),
  terms: (seed.termsAndConditions?.sections || []).map((s) => s.title),
  seo: seed.pageSeo?.home,
  whyUs: seed.whyUs,
  avail: Object.fromEntries(["services", "packages", "products", "blog", "partnership", "home", "team"].map((k) => [k, siteContent.isPageAvailable(k)])),
  json: JSON.stringify(seed),
}));
`;

describe("white-label / module-aware defaults", () => {
  test("shop+blog instanca: neutralni podaci, bez Estetik Lab teksta i bez booking sekcija", () => {
    const out = run({ WHITE_LABEL: "true", ENABLED_MODULES: "shop,blog", SITE_NAME: "TopHelanke", BASE_URL: "https://tophelanke.rs" }, SEED);
    assert.equal(out.business.name, "TopHelanke");
    assert.equal(out.business.taxId, null);
    assert.equal(out.business.phone, "");
    assert.equal(out.business.siteUrl, "https://tophelanke.rs");
    assert.deepEqual(out.business.sameAs, []);
    assert.doesNotMatch(out.json, /Estetik|beautymedica|Novi Sad|Novom Sadu|Maksima Gorkog|100154658|href=\\"mailto:\\"/);
    assert.match(out.json, /info@tophelanke\.rs/);
    assert.equal(out.hero.ctaUrl, "/prodavnica");
    assert.equal(out.hero.secondaryCtaUrl, "/blog");
    assert.deepEqual(out.whyUs, []);
    assert.ok(out.terms.length > 0);
    assert.ok(!out.terms.some((t) => /zakazivanje|termin/i.test(t)), out.terms.join("|"));
    assert.ok(out.terms.some((t) => /Kupovina proizvoda/i.test(t)));
    assert.match(out.terms[0], /^1\./);
    // stari hero sa linkovima na isključene module se preusmerava
    assert.equal(out.adapted.ctaUrl, "/prodavnica");
    assert.equal(out.adapted.secondaryCtaUrl, "/blog");
    // stranice isključenog modula se ne nude u SEO adminu / javnom API-ju
    assert.deepEqual(out.avail, { services: false, packages: false, products: true, blog: true, partnership: true, home: true, team: true });
  });

  test("samo blog: hero vodi na blog/kontakt, terms bez prodavnice i termina", () => {
    const out = run({ WHITE_LABEL: "1", ENABLED_MODULES: "blog", SITE_NAME: "Moj Blog" }, SEED);
    assert.equal(out.hero.ctaUrl, "/blog");
    assert.equal(out.hero.secondaryCtaUrl, "/kontakt");
    assert.ok(!out.terms.some((t) => /porud[zž]bin|proizvod|termin/i.test(t)), out.terms.join("|"));
  });

  test("Estetik Lab (bez WHITE_LABEL, svi moduli): ništa se ne menja", () => {
    const out = run({}, SEED);
    assert.deepEqual(out.seedKeys, []);
    assert.equal(out.business.name, "Estetik Lab");
    assert.equal(out.adapted.ctaUrl, "/usluge");
    assert.equal(out.adapted.secondaryCtaUrl, "/paketi");
  });
});
