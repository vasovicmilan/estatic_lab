import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preparePackageListData, preparePackageDetailsData, preparePackageFormData } from "../../../../../src/presenters/admin/catalog/package.presenter.js";

function buildMappedPackage(overrides = {}) {
  return {
    id: "pkg-1",
    naziv: "3 masaze",
    slug: "3-masaze",
    kratakOpis: "Kratak opis",
    opis: "Duzi opis...",
    slika: null,
    galerija: [],
    stavke: [{ usluga: { naziv: "Masaza" }, varijanta: { naziv: "Standard" }, brojSeansi: 3 }],
    faq: [],
    cena: 9000,
    staraCena: null,
    ukupnoTrajanje: "180 min",
    oznaka: null,
    najbolji: false,
    aktivan: true,
    vreme: { kreiran: "01.01.2026.", azuriran: "01.01.2026." },
    ...overrides,
  };
}

describe("preparePackageListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedPackage()], page: 1, totalPages: 2 };
    const view = preparePackageListData(result, { search: "masaza" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });
});

describe("preparePackageDetailsData", () => {
  it("shows 'Nema slike' when the package has no image", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ slika: null }));
    const imageSection = view.sections.find((s) => s.title === "Slika");

    assert.equal(imageSection.content, "Nema slike");
  });

  it("omits the gallery section entirely when there are no gallery images", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ galerija: [] }));
    assert.ok(!view.sections.some((s) => s.title === "Galerija"));
  });

  it("renders one <img> per gallery image when present", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ galerija: [{ url: "/a.webp" }, { url: "/b.webp" }] }));
    const gallerySection = view.sections.find((s) => s.title === "Galerija");

    assert.equal((gallerySection.content.match(/<img/g) || []).length, 2);
  });

  it("lists each package item as 'service - variant: N seansi'", () => {
    const view = preparePackageDetailsData(buildMappedPackage());
    const itemsSection = view.sections.find((s) => s.title === "Usluge u paketu");

    assert.equal(itemsSection.rows[0].label, "Masaza - Standard");
    assert.equal(itemsSection.rows[0].value, "3 seansi");
  });

  it("shows a placeholder for a missing old price", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ staraCena: null }));
    const priceSection = view.sidebar.find((s) => s.title === "Cena");

    assert.equal(priceSection.rows.find((r) => r.label === "Stara cena").value, "-");
  });

  it("shows the real old price when a discount is configured", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ staraCena: 12000 }));
    const priceSection = view.sidebar.find((s) => s.title === "Cena");

    assert.equal(priceSection.rows.find((r) => r.label === "Stara cena").value, "12000 RSD");
  });

  it("lists each FAQ entry as a question/answer row", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ faq: [{ pitanje: "Da li paket ima rok trajanja?", odgovor: "Da, 6 meseci." }] }));
    const faqSection = view.sections.find((s) => s.title === "FAQ");

    assert.equal(faqSection.rows[0].label, "Da li paket ima rok trajanja?");
  });

  it("uses the package name as the last breadcrumb", () => {
    const view = preparePackageDetailsData(buildMappedPackage({ naziv: "5 masaza" }));
    assert.equal(view.breadcrumbs.at(-1).label, "5 masaza");
  });
});

describe("preparePackageFormData - variantKey encoding", () => {
  it("encodes each item's service+variant as 'serviceId::servicePackageId' for the repeater's select", () => {
    const view = preparePackageFormData({ id: "p1", name: "3 masaze", items: [{ service: "svc1", servicePackageId: "var1", sessions: 3 }] }, {});
    const itemsField = view.fields.find((f) => f.name === "items");

    assert.equal(itemsField.value[0].variantKey, "svc1::var1");
    assert.equal(itemsField.value[0].sessions, 3);
  });

  it("leaves variantKey blank for a malformed/incomplete item rather than throwing", () => {
    const view = preparePackageFormData({ id: "p1", name: "3 masaze", items: [{ service: null, servicePackageId: null, sessions: 3 }] }, {});
    const itemsField = view.fields.find((f) => f.name === "items");

    assert.equal(itemsField.value[0].variantKey, "");
  });

  it("starts with an empty items list on create", () => {
    const view = preparePackageFormData(null, {});
    assert.deepEqual(view.fields.find((f) => f.name === "items").value, []);
  });
});

describe("preparePackageFormData - the rest", () => {
  it("omits the slug field on create, includes it on edit", () => {
    const createView = preparePackageFormData();
    const editView = preparePackageFormData({ id: "p1", name: "3 masaze", slug: "3-masaze" });

    assert.ok(!createView.fields.some((f) => f.name === "slug"));
    assert.ok(editView.fields.some((f) => f.name === "slug"));
  });

  it("requires the image field on create, not on edit", () => {
    const createView = preparePackageFormData();
    const editView = preparePackageFormData({ id: "p1", name: "3 masaze" });

    assert.equal(createView.fields.find((f) => f.name === "packageImage").required, true);
    assert.equal(editView.fields.find((f) => f.name === "packageImage").required, false);
  });

  it("normalizes mixed populated category/tag objects and raw ids into plain id strings", () => {
    const view = preparePackageFormData({ id: "p1", name: "3 masaze", categories: [{ id: "c1" }, "c2"] }, {});
    assert.deepEqual(view.fields.find((f) => f.name === "categories").value, ["c1", "c2"]);
  });

  it("uses multipart/form-data since this form can upload an image", () => {
    const view = preparePackageFormData();
    assert.equal(view.formEnctype, "multipart/form-data");
  });
});