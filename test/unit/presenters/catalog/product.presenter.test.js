import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareProductListData,
  prepareProductCategoryData,
  prepareProductTagData,
  prepareProductDetailData,
} from "../../../../src/presenters/catalog/product.presenter.js";

describe("prepareProductListData - buildCategoryTabRows (top-level row)", () => {
  it("always includes an 'all products' tab first, marked active when no category filter is applied", () => {
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 }, { categories: [{ id: "c1", naziv: "Delovi", slug: "delovi", parent: null, count: 3 }], totalCount: 10 });

    assert.equal(view.categoryTabRows[0][0].label, "Svi proizvodi");
    assert.equal(view.categoryTabRows[0][0].active, true);
    assert.equal(view.categoryTabRows[0][0].count, 10);
    assert.equal(view.categoryTabRows[0][1].active, false);
  });

  it("shows the intro copy, trust badges, and FAQ only on the plain landing view", () => {
    const landing = prepareProductListData({ data: [], page: 1, totalPages: 1 }, { isLandingView: true });
    const filtered = prepareProductListData({ data: [], page: 1, totalPages: 1 }, { isLandingView: false });

    assert.ok(landing.intro);
    assert.ok(landing.trust.length > 0);
    assert.ok(landing.faq.length > 0);

    assert.equal(filtered.intro, null);
    assert.deepEqual(filtered.trust, []);
    assert.deepEqual(filtered.faq, []);
  });

  it("defaults latestPosts to an empty array", () => {
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 });
    assert.deepEqual(view.latestPosts, []);
  });
});

describe("prepareProductCategoryData - multi-tier category navigation (buildCategoryTabRows)", () => {
  // Kozmetika (top-level) > HL/Skin (child) > Nega lica / Nega tela (grandchildren) -
  // the same 3-level shape the real HL/Skin category tree uses.
  const kozmetika = { id: "kozmetika", naziv: "Kozmetika", slug: "kozmetika", parent: null, count: 5 };
  const aparati = { id: "aparati", naziv: "Aparati i oprema", slug: "aparati-i-oprema", parent: null, count: 44 };
  const hlSkin = { id: "hl-skin", naziv: "HL/Skin", slug: "hl-skin", parent: "kozmetika", count: 5 };
  const postTretman = { id: "post-tretman", naziv: "Kozmetički proizvodi za post-tretman", slug: "post-tretman", parent: "kozmetika", count: 0 };
  const negaLica = { id: "nega-lica", naziv: "Nega lica", slug: "nega-lica", parent: "hl-skin", count: 3 };
  const negaTela = { id: "nega-tela", naziv: "Nega tela", slug: "nega-tela", parent: "hl-skin", count: 2 };
  const allCategories = [kozmetika, aparati, hlSkin, postTretman, negaLica, negaTela];

  it("viewing a top-level category shows only top-level chips in row 0, none of its children yet", () => {
    const view = prepareProductCategoryData(kozmetika, { data: [], page: 1, totalPages: 1 }, {}, { categories: allCategories });

    assert.equal(view.categoryTabRows.length, 2, "row 0 (top-level) + row 1 (Kozmetika's children)");
    assert.equal(view.categoryTabRows[0].find((t) => t.label === "Kozmetika").active, true);
    assert.equal(view.categoryTabRows[0].find((t) => t.label === "Aparati i oprema").active, false);
  });

  it("viewing a top-level category with children shows those children as row 1, none marked active", () => {
    const view = prepareProductCategoryData(kozmetika, { data: [], page: 1, totalPages: 1 }, {}, { categories: allCategories });

    const row1Labels = view.categoryTabRows[1].map((t) => t.label).sort();
    assert.deepEqual(row1Labels, ["HL/Skin", "Kozmetički proizvodi za post-tretman"]);
    assert.ok(view.categoryTabRows[1].every((t) => t.active === false));
  });

  it("viewing a mid-level category (HL/Skin) marks its own chip active in row 1 and shows ITS children in row 2", () => {
    const view = prepareProductCategoryData(hlSkin, { data: [], page: 1, totalPages: 1 }, {}, { categories: allCategories });

    assert.equal(view.categoryTabRows.length, 3);
    assert.equal(view.categoryTabRows[0].find((t) => t.label === "Kozmetika").active, true, "Kozmetika is HL/Skin's parent, so it's the active top-level ancestor");
    assert.equal(view.categoryTabRows[1].find((t) => t.label === "HL/Skin").active, true);
    const row2Labels = view.categoryTabRows[2].map((t) => t.label).sort();
    assert.deepEqual(row2Labels, ["Nega lica", "Nega tela"]);
  });

  it("viewing a leaf category (Nega lica) walks the full ancestor chain and shows an empty-children final row", () => {
    const view = prepareProductCategoryData(negaLica, { data: [], page: 1, totalPages: 1 }, {}, { categories: allCategories });

    assert.equal(view.categoryTabRows[0].find((t) => t.label === "Kozmetika").active, true);
    assert.equal(view.categoryTabRows[1].find((t) => t.label === "HL/Skin").active, true);
    assert.equal(view.categoryTabRows[2].find((t) => t.label === "Nega lica").active, true);
    // Nega lica has no children of its own, so there's no row 3
    assert.equal(view.categoryTabRows.length, 3);
  });

  it("a category with no children at all produces just the one top-level row", () => {
    const view = prepareProductCategoryData(aparati, { data: [], page: 1, totalPages: 1 }, {}, { categories: allCategories });
    assert.equal(view.categoryTabRows.length, 1);
  });
});

describe("prepareProductCategoryData", () => {
  it("marks the current category's own tab as active among the others", () => {
    const categories = [
      { id: "c1", naziv: "Delovi", slug: "delovi", parent: null, count: 3 },
      { id: "c2", naziv: "Oprema", slug: "oprema", parent: null, count: 2 },
    ];
    const view = prepareProductCategoryData({ naziv: "Delovi", slug: "delovi" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    const active = view.categoryTabRows[0].filter((t) => t.active);
    assert.equal(active.length, 1);
    assert.equal(active[0].label, "Delovi");
  });

  it("scopes pagination to the category's own URL", () => {
    const view = prepareProductCategoryData({ naziv: "Delovi", slug: "delovi" }, { data: [], page: 2, totalPages: 3 }, {});
    assert.equal(view.pagination.basePath, "/prodavnica/kategorija/delovi");
  });

  it("uses the category name as the last breadcrumb", () => {
    const view = prepareProductCategoryData({ naziv: "Oprema", slug: "oprema" }, { data: [], page: 1, totalPages: 1 }, {});
    assert.equal(view.breadcrumbs.at(-1).label, "Oprema");
  });
});

describe("prepareProductTagData", () => {
  it("scopes pagination to the tag's own URL, distinct from category pagination", () => {
    const view = prepareProductTagData({ naziv: "akcija", slug: "akcija" }, { data: [], page: 1, totalPages: 1 }, {});
    assert.equal(view.pagination.basePath, "/prodavnica/tag/akcija");
  });

  it("does not mark any category tab active - a tag filter is independent of category selection", () => {
    const categories = [{ id: "c1", naziv: "Delovi", slug: "delovi", parent: null, count: 3 }];
    const view = prepareProductTagData({ naziv: "akcija", slug: "akcija" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    assert.ok(!view.categoryTabRows[0].some((t) => t.active && t.label !== "Svi proizvodi"));
  });

  it("marks the current tag's chip as active, without touching the other chips", () => {
    const tags = [
      { naziv: "lavanda", slug: "lavanda" },
      { naziv: "esma", slug: "esma" },
    ];
    const view = prepareProductTagData({ naziv: "Lavanda", slug: "lavanda" }, { data: [], page: 1, totalPages: 1 }, {}, { tags });

    assert.equal(view.tagChips.find((t) => t.label === "lavanda").active, true);
    assert.equal(view.tagChips.find((t) => t.label === "esma").active, false);
  });
});

describe("prepareProductListData / prepareProductCategoryData - tagChips", () => {
  it("exposes tagChips on the landing view, with none marked active", () => {
    const tags = [{ naziv: "lavanda", slug: "lavanda" }];
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 }, { tags });

    assert.equal(view.tagChips.length, 1);
    assert.equal(view.tagChips[0].href, "/prodavnica/tag/lavanda");
    assert.equal(view.tagChips[0].active, false);
  });

  it("defaults tagChips to an empty array when no tags are passed", () => {
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 }, {});
    assert.deepEqual(view.tagChips, []);
  });

  it("exposes tagChips on a category-filtered view too", () => {
    const tags = [{ naziv: "esma", slug: "esma" }];
    const view = prepareProductCategoryData({ naziv: "Delovi", slug: "delovi" }, { data: [], page: 1, totalPages: 1 }, {}, { tags });

    assert.equal(view.tagChips.length, 1);
    assert.equal(view.tagChips[0].label, "esma");
  });
});

describe("prepareProductListData - search", () => {
  it("exposes the search term from the query for the input's value and the results heading", () => {
    const view = prepareProductListData({ data: [], total: 0, page: 1, totalPages: 1 }, { query: { search: "aparat" } });
    assert.equal(view.search, "aparat");
  });

  it("exposes the total result count separately from the paginated page size", () => {
    const view = prepareProductListData({ data: [{}, {}], total: 27, page: 1, totalPages: 3 }, { query: { search: "laser" } });
    assert.equal(view.resultCount, 27);
  });

  it("defaults search to an empty string when there's no query at all", () => {
    const view = prepareProductListData({ data: [], total: 0, page: 1, totalPages: 1 }, {});
    assert.equal(view.search, "");
  });
});

describe("prepareProductDetailData", () => {
  it("defaults relatedProducts and testimonials to empty arrays", () => {
    const view = prepareProductDetailData({ naziv: "ESMA uredjaj" });
    assert.deepEqual(view.relatedProducts, []);
    assert.deepEqual(view.testimonials, []);
  });

  it("uses the product's name as the last breadcrumb", () => {
    const view = prepareProductDetailData({ naziv: "ESMA uredjaj" });
    assert.equal(view.breadcrumbs.at(-1).label, "ESMA uredjaj");
  });
});