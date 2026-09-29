import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SITE_CONTENT_SECTIONS,
  findSectionBySlug,
  prepareSiteContentIndexData,
  prepareSiteContentFormData,
} from "../../../../../src/presenters/admin/marketing/site-content.presenter.js";

describe("site-content.presenter", () => {
  it("exposes every section (and API slug) of api/v1/admin-ops.routes.js /site-content/*", () => {
    assert.deepEqual(
      SITE_CONTENT_SECTIONS.map((s) => s.slug),
      ["o-nama", "faq", "politika-privatnosti", "uslovi-koriscenja", "partnerski-program", "pocetna-uvod", "zasto-mi", "tim-uvod", "pocetna-hero", "usluge-uvod", "paketi-uvod", "prodavnica-uvod", "blog-uvod", "kontakt", "seo-stranica"]
    );
    assert.equal(new Set(SITE_CONTENT_SECTIONS.map((s) => s.key)).size, 15);
  });

  it("findSectionBySlug returns null for an unknown slug", () => {
    assert.equal(findSectionBySlug("o-nama").key, "about");
    assert.equal(findSectionBySlug("nema-ga"), null);
  });

  it("index cards link to the edit page and the public page, with a content summary", () => {
    const view = prepareSiteContentIndexData({
      about: { intro: "x", sections: [{ title: "a" }, { title: "b" }] },
      faq: { items: [{ pitanje: "p", odgovor: "o" }] },
      privacyPolicy: { lastUpdated: "1. januar", intro: "x", sections: [] },
      termsAndConditions: { lastUpdated: "2. januar", intro: "x", sections: [] },
      partnership: { intro: "x", steps: [1, 2, 3], highlights: [] },
      homeIntro: { massages: [1, 2] },
      whyUs: [1, 2, 3, 4],
      teamIntro: { highlights: [1] },
    });

    assert.equal(view.cards.length, 15);
    const about = view.cards.find((c) => c.title === "O nama");
    assert.equal(about.editUrl, "/admin/sajt/sadrzaj/o-nama");
    assert.equal(about.publicUrl, "/o-nama");
    assert.equal(about.summary, "2 sekcija");
    assert.match(view.cards.find((c) => c.title === "Politika privatnosti").summary, /ažurirano: 1\. januar/);
    assert.equal(view.cards.find((c) => c.title === "Zašto mi").summary, "4 kartica");
  });

  it("index does not crash with no content yet", () => {
    assert.equal(prepareSiteContentIndexData(undefined).cards.length, 15);
  });

  it("form: about exposes intro (textarea) and sections (builder) with current values", () => {
    const sections = [{ title: "T", paragraphs: ["p"] }];
    const view = prepareSiteContentFormData("about", { intro: "Uvod", sections });

    assert.equal(view.formAction, "/admin/sajt/sadrzaj/o-nama");
    assert.equal(view.formMethod, "PUT");
    const intro = view.fields.find((f) => f.name === "intro");
    assert.equal(intro.type, "textarea");
    assert.equal(intro.value, "Uvod");
    const sectionsField = view.fields.find((f) => f.name === "sections");
    assert.equal(sectionsField.type, "sections");
    assert.deepEqual(sectionsField.value, sections);
  });

  it("form: partnership highlights are a 'lines' field rendered one per line", () => {
    const view = prepareSiteContentFormData("partnership", { intro: "i", steps: [], highlights: ["a", "b"] });
    const highlights = view.fields.find((f) => f.name === "highlights");
    assert.equal(highlights.type, "lines");
    assert.equal(highlights.value, "a\nb");
  });

  it("form: whyUs content is the array itself (no wrapper object)", () => {
    const cards = [{ icon: "bi-x", title: "t", text: "x" }];
    const view = prepareSiteContentFormData("whyUs", cards);
    assert.deepEqual(view.fields.find((f) => f.name === "whyUs").value, cards);
  });

  it("form: missing content falls back to empty values instead of throwing", () => {
    for (const { key } of SITE_CONTENT_SECTIONS) {
      const view = prepareSiteContentFormData(key, undefined);
      assert.ok(view.fields.length > 0, key);
    }
  });
});
