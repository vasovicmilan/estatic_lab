import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareBlogListData,
  prepareBlogCategoryData,
  prepareBlogTagData,
  prepareBlogPostData,
} from "../../../../src/presenters/blog/blog.presenter.js";

describe("prepareBlogListData", () => {
  it("shows the intro copy on the plain landing page (no active search)", () => {
    const view = prepareBlogListData({ data: [], page: 1, totalPages: 1 }, {});
    assert.ok(view.intro);
    assert.equal(view.search, "");
  });

  it("hides the intro copy once a search is active", () => {
    const view = prepareBlogListData({ data: [], page: 1, totalPages: 1 }, { query: { search: "esma" } });
    assert.equal(view.intro, null);
    assert.equal(view.search, "esma");
  });

  it("always includes an 'all posts' tab first, marked active when no category is selected", () => {
    const view = prepareBlogListData(
      { data: [], page: 1, totalPages: 1 },
      { categories: [{ naziv: "Masaze", slug: "masaze", count: 3 }], totalCount: 10 }
    );

    assert.equal(view.categoryTabs[0].label, "Sve objave");
    assert.equal(view.categoryTabs[0].active, true);
    assert.equal(view.categoryTabs[0].count, 10);
    assert.equal(view.categoryTabs[1].active, false);
  });
});

describe("prepareBlogCategoryData", () => {
  it("marks only the current category's tab as active", () => {
    const categories = [
      { naziv: "Masaze", slug: "masaze", count: 3 },
      { naziv: "Nega lica", slug: "nega-lica", count: 2 },
    ];
    const view = prepareBlogCategoryData({ naziv: "Masaze", slug: "masaze" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    const active = view.categoryTabs.filter((t) => t.active);
    assert.equal(active.length, 1);
    assert.equal(active[0].label, "Masaze");
  });

  it("scopes pagination to the category's own URL", () => {
    const view = prepareBlogCategoryData({ naziv: "Masaze", slug: "masaze" }, { data: [], page: 2, totalPages: 3 }, {});
    assert.equal(view.pagination.basePath, "/blog/kategorija/masaze");
  });
});

describe("prepareBlogTagData", () => {
  it("marks the current tag's chip as active, without touching the category tabs", () => {
    const tags = [
      { naziv: "esma", slug: "esma" },
      { naziv: "opustanje", slug: "opustanje" },
    ];
    const view = prepareBlogTagData({ naziv: "ESMA", slug: "esma" }, { data: [], page: 1, totalPages: 1 }, {}, { tags });

    assert.equal(view.tagChips.find((t) => t.label === "esma").active, true);
    assert.equal(view.tagChips.find((t) => t.label === "opustanje").active, false);
  });
});

describe("prepareBlogPostData - buildTableOfContents", () => {
  it("only includes level-2 headings, skipping other heading levels and non-heading blocks", () => {
    const post = {
      naslov: "Test",
      sadrzaj: [
        { tip: "heading", nivo: 1, tekst: "Naslov" },
        { tip: "heading", nivo: 2, tekst: "Prva sekcija" },
        { tip: "paragraph", tekst: "Tekst..." },
        { tip: "heading", nivo: 3, tekst: "Pod-sekcija" },
      ],
    };
    const view = prepareBlogPostData(post);

    assert.equal(view.toc.length, 1);
    assert.equal(view.toc[0].label, "Prva sekcija");
  });

  it("converts Serbian Latin diacritics to plain ASCII in the anchor", () => {
    const post = { naslov: "Test", sadrzaj: [{ tip: "heading", nivo: 2, tekst: "Šta je ESMA tretman?" }] };
    const view = prepareBlogPostData(post);

    assert.equal(view.toc[0].href, "#sta-je-esma-tretman");
  });

  it("de-duplicates identical heading text with a numeric suffix, so anchors never collide", () => {
    const post = {
      naslov: "Test",
      sadrzaj: [
        { tip: "heading", nivo: 2, tekst: "Zakljucak" },
        { tip: "heading", nivo: 2, tekst: "Zakljucak" },
      ],
    };
    const view = prepareBlogPostData(post);

    assert.equal(view.toc[0].href, "#zakljucak");
    assert.equal(view.toc[1].href, "#zakljucak-2");
    assert.notEqual(view.toc[0].href, view.toc[1].href);
  });

  it("writes the same anchor back onto the heading block itself, so the TOC link and the heading id can never drift apart", () => {
    const post = { naslov: "Test", sadrzaj: [{ tip: "heading", nivo: 2, tekst: "Bezbednost" }] };
    const view = prepareBlogPostData(post);

    assert.equal(post.sadrzaj[0].kotva, "bezbednost");
    assert.equal(view.toc[0].href, `#${post.sadrzaj[0].kotva}`);
  });

  it("falls back to a generic anchor for a heading with no usable text", () => {
    const post = { naslov: "Test", sadrzaj: [{ tip: "heading", nivo: 2, tekst: "" }] };
    const view = prepareBlogPostData(post);

    assert.equal(view.toc[0].href, "#sekcija");
  });

  it("returns an empty table of contents for a post with no content blocks", () => {
    const view = prepareBlogPostData({ naslov: "Test" });
    assert.deepEqual(view.toc, []);
  });
});

describe("prepareBlogPostData - author initials and category label", () => {
  it("computes the author's initials from their first two name parts", () => {
    const post = { naslov: "Test", autor: { ime: "Milan Vasovic" } };
    prepareBlogPostData(post);

    assert.equal(post.autor.inicijali, "MV");
  });

  it("caps initials at two letters even for a longer name", () => {
    const post = { naslov: "Test", autor: { ime: "Jovan Petar Nikolic" } };
    prepareBlogPostData(post);

    assert.equal(post.autor.inicijali, "JP");
  });

  it("skips initials entirely when the post has no author", () => {
    const post = { naslov: "Test" };
    const view = prepareBlogPostData(post);
    assert.equal(view.post.autor, undefined);
  });

  it("humanizes the first category's slug into a display label", () => {
    const post = { naslov: "Test", kategorije: ["nega-lica"] };
    prepareBlogPostData(post);

    assert.equal(post.kategorijaLabel, "Nega Lica");
  });

  it("leaves the category label null when the post has no categories", () => {
    const post = { naslov: "Test", kategorije: [] };
    prepareBlogPostData(post);

    assert.equal(post.kategorijaLabel, null);
  });
});

describe("prepareBlogPostData", () => {
  it("defaults relatedPosts to an empty array", () => {
    const view = prepareBlogPostData({ naslov: "Test" });
    assert.deepEqual(view.relatedPosts, []);
  });

  it("uses the post's title as the last breadcrumb", () => {
    const view = prepareBlogPostData({ naslov: "Šta je ESMA tretman?" });
    assert.equal(view.breadcrumbs.at(-1).label, "Šta je ESMA tretman?");
  });
});