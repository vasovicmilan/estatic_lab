import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preparePostListData,
  preparePostDetailsData,
  preparePostFormData,
  preparePostSeoFormData,
} from "../../../../../src/presenters/admin/blog/post.presenter.js";

function buildMappedPost(overrides = {}) {
  return {
    id: "post-1",
    naslov: "Sta je ESMA tretman?",
    slug: "sta-je-esma-tretman",
    status: "Objavljeno",
    autor: { ime: "Milan Vasovic" },
    kratakOpis: "Kratak opis...",
    slika: null,
    galerija: [],
    sadrzaj: [],
    kategorije: [],
    tagovi: [],
    seo: { naslov: null, opis: null },
    indeksiranje: "Dozvoljeno",
    vremeCitanja: "5 min",
    pregledi: 100,
    datumObjave: "01.01.2026.",
    zakazanoZa: null,
    vreme: { kreiran: "01.01.2026.", azuriran: "01.01.2026." },
    ...overrides,
  };
}

describe("preparePostListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedPost()], page: 1, totalPages: 2 };
    const view = preparePostListData(result, { search: "esma" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("includes a SEO shortcut action alongside view/edit/delete", () => {
    const view = preparePostListData({ data: [], page: 1, totalPages: 1 });
    assert.ok(view.actions.some((a) => a.label === "SEO"));
  });

  it("offers all 4 post statuses as filter options", () => {
    const view = preparePostListData({ data: [], page: 1, totalPages: 1 });
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");

    assert.deepEqual(statusFilter.options.map((o) => o.value), ["", "draft", "scheduled", "published", "archived"]);
  });
});

describe("preparePostDetailsData", () => {
  it("shows 'Nema slike' when the post has no cover image", () => {
    const view = preparePostDetailsData(buildMappedPost({ slika: null }));
    const imageSection = view.sections.find((s) => s.title === "Naslovna slika");

    assert.equal(imageSection.content, "Nema slike");
  });

  it("renders an <img> tag when the post has a cover image", () => {
    const view = preparePostDetailsData(buildMappedPost({ slika: { url: "/x.webp", alt: "x" } }));
    const imageSection = view.sections.find((s) => s.title === "Naslovna slika");

    assert.match(imageSection.content, /<img src="\/x\.webp"/);
  });

  it("omits the gallery section entirely when there are no gallery images", () => {
    const view = preparePostDetailsData(buildMappedPost({ galerija: [] }));
    assert.ok(!view.sections.some((s) => s.title === "Galerija"));
  });

  it("renders one <img> per gallery image when present", () => {
    const view = preparePostDetailsData(buildMappedPost({ galerija: [{ url: "/a.webp" }, { url: "/b.webp" }] }));
    const gallerySection = view.sections.find((s) => s.title === "Galerija");

    assert.equal((gallerySection.content.match(/<img/g) || []).length, 2);
  });

  it("shows 'Nije objavljeno' when the post hasn't been published yet", () => {
    const view = preparePostDetailsData(buildMappedPost({ datumObjave: null }));
    const timeSection = view.sections.find((s) => s.title === "Vreme");

    assert.equal(timeSection.rows.find((r) => r.label === "Objavljeno").value, "Nije objavljeno");
  });

  it("includes a 'Zakazano za' row only when the post is actually scheduled", () => {
    const scheduled = preparePostDetailsData(buildMappedPost({ zakazanoZa: "10.01.2026." }));
    const notScheduled = preparePostDetailsData(buildMappedPost({ zakazanoZa: null }));

    const scheduledSection = scheduled.sections.find((s) => s.title === "Vreme");
    const notScheduledSection = notScheduled.sections.find((s) => s.title === "Vreme");

    assert.ok(scheduledSection.rows.some((r) => r.label === "Zakazano za"));
    assert.ok(!notScheduledSection.rows.some((r) => r.label === "Zakazano za"));
  });

  it("joins categories/tags into comma-separated text, with a placeholder when empty", () => {
    const view = preparePostDetailsData(buildMappedPost({ kategorije: ["Masaze", "Nega"], tagovi: [] }));
    const classSection = view.sections.find((s) => s.title === "Klasifikacija");

    assert.equal(classSection.rows.find((r) => r.label === "Kategorije").value, "Masaze, Nega");
    assert.equal(classSection.rows.find((r) => r.label === "Tagovi").value, "-");
  });

  it("uses the post's title as the last breadcrumb", () => {
    const view = preparePostDetailsData(buildMappedPost({ naslov: "Naslov teksta" }));
    assert.equal(view.breadcrumbs.at(-1).label, "Naslov teksta");
  });
});

describe("preparePostFormData", () => {
  it("omits the slug field on create, includes it on edit", () => {
    const createView = preparePostFormData();
    const editView = preparePostFormData({ id: "p1", title: "Test", slug: "test", status: "draft" });

    assert.ok(!createView.fields.some((f) => f.name === "slug"));
    assert.ok(editView.fields.some((f) => f.name === "slug"));
  });

  it("requires the cover image on create, but not on edit", () => {
    const createView = preparePostFormData();
    const editView = preparePostFormData({ id: "p1", title: "Test", status: "draft" });

    assert.equal(createView.fields.find((f) => f.name === "coverImage").required, true);
    assert.equal(editView.fields.find((f) => f.name === "coverImage").required, false);
  });

  it("passes relatedSummary straight through for the shared admin/_form banner, defaulting to empty", () => {
    const withDefault = preparePostFormData({ id: "p1", title: "Test", status: "draft" });
    assert.deepEqual(withDefault.relatedSummary, []);

    const withSummary = preparePostFormData(
      { id: "p1", title: "Test", status: "draft" },
      { relatedSummary: ["2 povezane usluge", "1 povezan proizvod"] }
    );
    assert.deepEqual(withSummary.relatedSummary, ["2 povezane usluge", "1 povezan proizvod"]);
  });

  it("normalizes mixed populated category/tag objects and raw ids into plain id strings", () => {
    const view = preparePostFormData({ id: "p1", title: "Test", status: "draft", categories: [{ id: "c1" }, "c2"], tags: [{ id: "t1" }] });

    assert.deepEqual(view.fields.find((f) => f.name === "categories").value, ["c1", "c2"]);
    assert.deepEqual(view.fields.find((f) => f.name === "tags").value, ["t1"]);
  });

  it("normalizes a populated author object down to just its id", () => {
    const view = preparePostFormData({ id: "p1", title: "Test", status: "draft", author: { id: "a1", ime: "Milan" } });
    assert.equal(view.fields.find((f) => f.name === "author").value, "a1");
  });

  it("defaults a new post's status to 'draft'", () => {
    const view = preparePostFormData();
    assert.equal(view.fields.find((f) => f.name === "status").value, "draft");
  });

  it("uses multipart/form-data since this form can upload a cover image", () => {
    const view = preparePostFormData();
    assert.equal(view.formEnctype, "multipart/form-data");
  });
});

describe("preparePostSeoFormData", () => {
  it("only exposes SEO title/description/indexability - a narrow, standalone edit form", () => {
    const view = preparePostSeoFormData(buildMappedPost({ seo: { naslov: "SEO naslov", opis: "SEO opis" }, indeksiranje: "Dozvoljeno" }));
    const fieldNames = view.fields.map((f) => f.name);

    assert.deepEqual(fieldNames.sort(), ["isIndexable", "seoDescription", "seoTitle"].sort());
    assert.equal(view.fields.find((f) => f.name === "isIndexable").value, true);
  });

  it("cancels back to the post's own detail page, not the list", () => {
    const view = preparePostSeoFormData(buildMappedPost({ id: "p1" }));
    assert.equal(view.cancelUrl, "/admin/blog/detalji/p1");
  });
});