import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareProductListData,
  prepareProductCategoryData,
  prepareProductTagData,
  prepareProductDetailData,
} from "../../../../src/presenters/catalog/product.presenter.js";

describe("prepareProductListData - buildCategoryTabs", () => {
  it("always includes an 'all products' tab first, marked active when no category filter is applied", () => {
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 }, { categories: [{ naziv: "Delovi", slug: "delovi", count: 3 }], totalCount: 10 });

    assert.equal(view.categoryTabs[0].label, "Svi proizvodi");
    assert.equal(view.categoryTabs[0].active, true);
    assert.equal(view.categoryTabs[0].count, 10);
    assert.equal(view.categoryTabs[1].active, false);
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

describe("prepareProductCategoryData", () => {
  it("marks the current category's own tab as active among the others", () => {
    const categories = [
      { naziv: "Delovi", slug: "delovi", count: 3 },
      { naziv: "Oprema", slug: "oprema", count: 2 },
    ];
    const view = prepareProductCategoryData({ naziv: "Delovi", slug: "delovi" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    const active = view.categoryTabs.filter((t) => t.active);
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
    const categories = [{ naziv: "Delovi", slug: "delovi", count: 3 }];
    const view = prepareProductTagData({ naziv: "akcija", slug: "akcija" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    assert.ok(!view.categoryTabs.some((t) => t.active && t.label !== "Svi proizvodi"));
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