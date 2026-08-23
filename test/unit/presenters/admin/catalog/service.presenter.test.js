import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareServiceListData,
  prepareServiceDetailsData,
  prepareServiceFormData,
  prepareServicePackagesStepData,
  prepareServiceExtrasStepData,
  prepareServiceSeoFormData,
} from "../../../../../src/presenters/admin/catalog/service.presenter.js";

function buildMappedService(overrides = {}) {
  return {
    id: "svc-1",
    naziv: "Masaza opustajuca",
    slug: "masaza-opustajuca",
    kratakOpis: "Opis...",
    kategorije: ["Masaze"],
    tagovi: [],
    resursi: [],
    trajanjePodrazumevano: "60 min",
    slika: null,
    galerija: [],
    varijante: [{ name: "Standard", duration: 60, totalPrice: 3000 }],
    karakteristike: [{ naziv: "Opustanje" }],
    faq: [],
    istaknuto: false,
    aktivna: true,
    vreme: { kreirana: "01.01.2026.", azurirana: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareServiceListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedService()], page: 1, totalPages: 2 };
    const view = prepareServiceListData(result, { search: "masaza" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("includes a SEO shortcut action alongside view/edit/delete", () => {
    const view = prepareServiceListData({ data: [], page: 1, totalPages: 1 });
    assert.ok(view.actions.some((a) => a.label === "SEO"));
  });
});

describe("prepareServiceDetailsData", () => {
  it("explains when no shared resources are required, rather than showing an empty value", () => {
    const view = prepareServiceDetailsData(buildMappedService({ resursi: [] }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.match(section.rows.find((r) => r.label === "Resursi (deljeni kapacitet)").value, /koristi se samo dostupnost zaposlenog/);
  });

  it("lists the actual resource names when the service does require shared resources", () => {
    const view = prepareServiceDetailsData(buildMappedService({ resursi: ["ESMA aparat"] }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Resursi (deljeni kapacitet)").value, "ESMA aparat");
  });

  it("shows 'Nema slike' when the service has no image", () => {
    const view = prepareServiceDetailsData(buildMappedService({ slika: null }));
    assert.equal(view.sections.find((s) => s.title === "Slika").content, "Nema slike");
  });

  it("omits the gallery section entirely when there are no gallery images", () => {
    const view = prepareServiceDetailsData(buildMappedService({ galerija: [] }));
    assert.ok(!view.sections.some((s) => s.title === "Galerija"));
  });

  it("renders one <img> per gallery image when present", () => {
    const view = prepareServiceDetailsData(buildMappedService({ galerija: [{ url: "/a.webp" }, { url: "/b.webp" }] }));
    const gallerySection = view.sections.find((s) => s.title === "Galerija");

    assert.equal((gallerySection.content.match(/<img/g) || []).length, 2);
  });

  it("passes the employee count through to the sidebar, defaulting to 0", () => {
    const withCount = prepareServiceDetailsData(buildMappedService(), { employeeCount: 3 });
    const withoutCount = prepareServiceDetailsData(buildMappedService());

    assert.equal(withCount.sidebar.find((s) => s.title === "Status").rows.find((r) => r.label === "Broj terapeuta").value, 3);
    assert.equal(withoutCount.sidebar.find((s) => s.title === "Status").rows.find((r) => r.label === "Broj terapeuta").value, 0);
  });

  it("shows 'Ne (nacrt)' for an inactive/draft service, not just 'Ne'", () => {
    const view = prepareServiceDetailsData(buildMappedService({ aktivna: false }));
    const statusSection = view.sidebar.find((s) => s.title === "Status");

    assert.equal(statusSection.rows.find((r) => r.label === "Aktivna").value, "Ne (nacrt)");
  });
});

describe("prepareServiceFormData - single-shot edit", () => {
  it("only includes packages/features/comparison/faq/isActive on edit, not on create - those are handled by the wizard phases", () => {
    const createView = prepareServiceFormData();
    const editView = prepareServiceFormData({ id: "s1", name: "Masaza" });

    for (const name of ["packages", "features", "faq", "isActive"]) {
      assert.ok(!createView.fields.some((f) => f.name === name), `${name} should not appear on create`);
      assert.ok(editView.fields.some((f) => f.name === name), `${name} should appear on edit`);
    }
  });

  it("labels resource options with their capacity, or flags them as inactive", () => {
    const view = prepareServiceFormData(null, {
      resourceOptions: [
        { id: "r1", naziv: "ESMA aparat", kapacitet: 1, aktivan: true },
        { id: "r2", naziv: "Stara oprema", kapacitet: 1, aktivan: false },
      ],
    });
    const resourcesField = view.fields.find((f) => f.name === "resources");

    assert.match(resourcesField.options[0].label, /kapacitet: 1/);
    assert.match(resourcesField.options[1].label, /NEAKTIVAN/);
  });

  it("shows a 3-phase progress indicator on create, none on edit", () => {
    const createView = prepareServiceFormData();
    const editView = prepareServiceFormData({ id: "s1", name: "Masaza" });

    assert.deepEqual(createView.phaseInfo, { label: "Nova usluga", current: 1, total: 3 });
    assert.equal(editView.phaseInfo, undefined);
  });

  it("requires the image on create, not on edit", () => {
    const createView = prepareServiceFormData();
    const editView = prepareServiceFormData({ id: "s1", name: "Masaza" });

    assert.equal(createView.fields.find((f) => f.name === "serviceImage").required, true);
    assert.equal(editView.fields.find((f) => f.name === "serviceImage").required, false);
  });

  it("joins comparisonColumns into a CSV string on edit", () => {
    const view = prepareServiceFormData({ id: "s1", name: "Masaza", comparisonColumns: ["Trajanje", "Cena"] });
    assert.equal(view.fields.find((f) => f.name === "comparisonColumnsCsv").value, "Trajanje, Cena");
  });
});

describe("prepareServicePackagesStepData (phase 2)", () => {
  it("is phase 2 of 3", () => {
    const view = prepareServicePackagesStepData({ id: "s1", name: "Masaza", packages: [] });
    assert.deepEqual(view.phaseInfo, { label: "Nova usluga - Masaza", current: 2, total: 3 });
  });

  it("posts to the packages sub-step endpoint for this specific service", () => {
    const view = prepareServicePackagesStepData({ id: "s1", name: "Masaza", packages: [] });
    assert.equal(view.formAction, "/admin/usluge/s1/dodavanje/paketi");
  });

  it("passes through any already-saved packages", () => {
    const view = prepareServicePackagesStepData({ id: "s1", name: "Masaza", packages: [{ name: "Standard", duration: 60, totalPrice: 3000 }] });
    assert.equal(view.fields.find((f) => f.name === "packages").value.length, 1);
  });
});

describe("prepareServiceExtrasStepData (phase 3)", () => {
  it("is phase 3 of 3", () => {
    const view = prepareServiceExtrasStepData({ id: "s1", name: "Masaza" });
    assert.deepEqual(view.phaseInfo, { label: "Nova usluga - Masaza", current: 3, total: 3 });
  });

  it("defaults the publish checkbox to checked - publishing immediately is the common case", () => {
    const view = prepareServiceExtrasStepData({ id: "s1", name: "Masaza" });
    assert.equal(view.fields.find((f) => f.name === "isActive").value, true);
  });

  it("posts to the extras sub-step endpoint for this specific service", () => {
    const view = prepareServiceExtrasStepData({ id: "s1", name: "Masaza" });
    assert.equal(view.formAction, "/admin/usluge/s1/dodavanje/detalji");
  });
});

describe("prepareServiceSeoFormData", () => {
  it("only exposes the SEO keywords field", () => {
    const view = prepareServiceSeoFormData({ id: "s1", naziv: "Masaza", seoKljucneReci: ["masaza", "opustanje"] });

    assert.equal(view.fields.length, 1);
    assert.equal(view.fields[0].value, "masaza, opustanje");
  });

  it("cancels back to the service's own detail page, not the list", () => {
    const view = prepareServiceSeoFormData({ id: "s1", naziv: "Masaza", seoKljucneReci: [] });
    assert.equal(view.cancelUrl, "/admin/usluge/detalji/s1");
  });
});