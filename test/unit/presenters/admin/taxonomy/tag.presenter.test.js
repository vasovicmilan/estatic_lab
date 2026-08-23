import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareTagListData, prepareTagDetailsData, prepareTagFormData } from "../../../../../src/presenters/admin/taxonomy/tag.presenter.js";

function buildMappedTag(overrides = {}) {
  return {
    id: "tag-1",
    naziv: "novo",
    slug: "novo",
    domen: "Proizvod",
    aktivan: true,
    vreme: { kreiran: "01.01.2026.", azuriran: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareTagListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedTag()], page: 1, totalPages: 2 };
    const view = prepareTagListData(result, { search: "novo" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("translates all three real category domains into a filter option, plus an 'all' option", () => {
    const view = prepareTagListData({ data: [], page: 1, totalPages: 1 });
    const domainFilter = view.topbar.filters.find((f) => f.name === "domain");

    assert.deepEqual(domainFilter.options, [
      { value: "", label: "Svi domeni" },
      { value: "post", label: "Blog" },
      { value: "service", label: "Usluga" },
      { value: "product", label: "Proizvod" },
    ]);
  });
});

describe("prepareTagDetailsData", () => {
  it("shows the tag's slug and translated domain", () => {
    const view = prepareTagDetailsData(buildMappedTag({ slug: "akcija", domen: "Proizvod" }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Slug").value, "akcija");
    assert.equal(section.rows.find((r) => r.label === "Domen").value, "Proizvod");
  });

  it("uses the tag's name as the last breadcrumb", () => {
    const view = prepareTagDetailsData(buildMappedTag({ naziv: "popust" }));
    assert.equal(view.breadcrumbs.at(-1).label, "popust");
  });
});

describe("prepareTagFormData", () => {
  it("omits the slug field entirely on create - it's auto-generated server-side", () => {
    const view = prepareTagFormData();
    assert.ok(!view.fields.some((f) => f.name === "slug"));
  });

  it("includes an editable slug field on edit, so an admin can deliberately change it", () => {
    const view = prepareTagFormData({ id: "t1", name: "novo", slug: "novo", domain: "product", isActive: true });
    const slugField = view.fields.find((f) => f.name === "slug");

    assert.ok(slugField);
    assert.equal(slugField.value, "novo");
  });

  it("defaults a new tag's domain to 'service'", () => {
    const view = prepareTagFormData();
    const domainField = view.fields.find((f) => f.name === "domain");

    assert.equal(domainField.value, "service");
  });

  it("gives the name field full width on create (no slug field alongside it yet), half width on edit", () => {
    const createView = prepareTagFormData();
    const editView = prepareTagFormData({ id: "t1", name: "novo", slug: "novo", domain: "product", isActive: true });

    assert.equal(createView.fields.find((f) => f.name === "name").width, 12);
    assert.equal(editView.fields.find((f) => f.name === "name").width, 6);
  });

  it("points the form action at POST /admin/tagovi on create, PUT .../:id on edit", () => {
    const createView = prepareTagFormData();
    const editView = prepareTagFormData({ id: "t1", name: "novo", slug: "novo", domain: "product", isActive: true });

    assert.equal(createView.formAction, "/admin/tagovi");
    assert.equal(editView.formAction, "/admin/tagovi/t1");
  });
});