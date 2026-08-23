import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareServiceListData,
  prepareServiceCategoryData,
  prepareServiceTagData,
  prepareServiceDetailData,
} from "../../../../src/presenters/catalog/service.presenter.js";

describe("prepareServiceListData", () => {
  it("always shows the intro copy (unlike products, services has no landing/filtered distinction)", () => {
    const view = prepareServiceListData({ data: [], page: 1, totalPages: 1 });
    assert.ok(view.intro);
  });

  it("computes stats from the actual totalCount and category count passed in", () => {
    const view = prepareServiceListData({ data: [], page: 1, totalPages: 1 }, { totalCount: 12, categories: [{ naziv: "Masaze", slug: "masaze" }] });

    assert.equal(view.stats[0].value, 12);
    assert.equal(view.stats[1].value, 1);
  });

  it("marks the 'all services' tab active when no category filter is applied", () => {
    const view = prepareServiceListData({ data: [], page: 1, totalPages: 1 }, { categories: [{ naziv: "Masaze", slug: "masaze" }] });

    assert.equal(view.categoryTabs[0].active, true);
    assert.equal(view.categoryTabs[1].active, false);
  });

  it("marks no tag chip active on the plain listing", () => {
    const view = prepareServiceListData({ data: [], page: 1, totalPages: 1 }, { tags: [{ naziv: "esma", slug: "esma" }] });
    assert.equal(view.tagChips[0].active, false);
  });
});

describe("prepareServiceCategoryData", () => {
  it("marks the current category's tab active", () => {
    const categories = [
      { naziv: "Masaze", slug: "masaze" },
      { naziv: "Nega lica", slug: "nega-lica" },
    ];
    const view = prepareServiceCategoryData({ naziv: "Masaze", slug: "masaze" }, { data: [], page: 1, totalPages: 1 }, {}, { categories });

    const active = view.categoryTabs.filter((t) => t.active);
    assert.equal(active.length, 1);
    assert.equal(active[0].label, "Masaze");
  });

  it("scopes pagination to the category's own URL", () => {
    const view = prepareServiceCategoryData({ naziv: "Masaze", slug: "masaze" }, { data: [], page: 1, totalPages: 1 }, {});
    assert.equal(view.pagination.basePath, "/usluge/kategorija/masaze");
  });
});

describe("prepareServiceTagData", () => {
  it("marks the current tag's chip active, without affecting category tabs", () => {
    const tags = [
      { naziv: "esma", slug: "esma" },
      { naziv: "opustanje", slug: "opustanje" },
    ];
    const view = prepareServiceTagData({ naziv: "ESMA", slug: "esma" }, { data: [], page: 1, totalPages: 1 }, {}, { tags });

    assert.equal(view.tagChips.find((t) => t.label === "esma").active, true);
    assert.equal(view.tagChips.find((t) => t.label === "opustanje").active, false);
  });

  it("scopes pagination to the tag's own URL", () => {
    const view = prepareServiceTagData({ naziv: "esma", slug: "esma" }, { data: [], page: 1, totalPages: 1 }, {});
    assert.equal(view.pagination.basePath, "/usluge/tag/esma");
  });
});

describe("prepareServiceDetailData", () => {
  it("builds the booking URL from the service's own slug", () => {
    const view = prepareServiceDetailData({ naziv: "Masaza", slug: "masaza-opustajuca" });
    assert.equal(view.bookingUrl, "/zakazivanje/masaza-opustajuca");
  });

  it("defaults relatedServices and testimonials to empty arrays", () => {
    const view = prepareServiceDetailData({ naziv: "Masaza", slug: "masaza" });
    assert.deepEqual(view.relatedServices, []);
    assert.deepEqual(view.testimonials, []);
  });

  it("uses the service's name as the last breadcrumb", () => {
    const view = prepareServiceDetailData({ naziv: "Masaza opustajuca", slug: "masaza-opustajuca" });
    assert.equal(view.breadcrumbs.at(-1).label, "Masaza opustajuca");
  });
});