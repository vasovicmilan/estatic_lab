import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareProductListData,
  prepareProductDetailsData,
  prepareProductCreateStep1Data,
  prepareProductFormData,
  prepareProductDetailsMediaStepData,
  prepareProductSeoPublishStepData,
  prepareProductSeoFormData,
} from "../../../../../src/presenters/admin/catalog/product.presenter.js";

// Input shapes mirror mapProductForAdminDetail/mapProductForEdit's real output
// (see product.mapper.js) - presenters only ever receive already-mapped data.
function buildMappedProduct(overrides = {}) {
  return {
    id: "product-1",
    naziv: "ESMA Uredjaj",
    name: "ESMA Uredjaj",
    sku: "ESMA-001",
    slug: "esma-uredjaj",
    kratakOpis: "Veliki uredjaj.",
    shortDescription: "Veliki uredjaj.",
    longDescription: "",
    kategorije: [],
    categories: [],
    tags: [],
    tagovi: [],
    slika: null,
    image: null,
    galerija: [],
    gallery: [],
    varijante: [{ label: "Standard", price: 250000, stock: 3 }],
    variations: [{ label: "Standard", price: 250000, stock: 3 }],
    povezaniProizvodi: [],
    relatedProducts: [],
    faq: [],
    seoKeywords: [],
    oznaka: null,
    badge: "none",
    nacinDostave: "Redovna posta",
    shippingClass: "standard",
    stanjeUkupno: 3,
    aktivan: true,
    isActive: true,
    vreme: { kreiran: "01.01.2026. 10:00", azuriran: "01.01.2026. 10:00" },
    ...overrides,
  };
}

describe("prepareProductListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedProduct()], page: 1, totalPages: 4 };
    const view = prepareProductListData(result, { search: "esma" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 4);
    assert.equal(view.topbar.search, "esma");
  });

  it("includes a SEO shortcut action alongside view/edit/delete", () => {
    const view = prepareProductListData({ data: [], page: 1, totalPages: 1 });
    const seoAction = view.actions.find((a) => a.label === "SEO");

    assert.ok(seoAction);
    assert.equal(seoAction.subPath, "seo");
  });
});

describe("prepareProductDetailsData", () => {
  it("shows the shipping class in the status sidebar", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ nacinDostave: "Veliki/tezak artikal - cena dostave se procenjuje rucno" }));
    const statusSection = view.sidebar.find((s) => s.title === "Status");
    const shippingRow = statusSection.rows.find((r) => r.label === "Način dostave");

    assert.match(shippingRow.value, /procenjuje rucno/);
  });

  it("omits the gallery section entirely when there are no gallery images", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ galerija: [] }));
    assert.ok(!view.sections.some((s) => s.title === "Galerija"));
  });

  it("includes a gallery section when gallery images exist", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ galerija: [{ url: "/images/products/x.webp", alt: "x" }] }));
    const gallerySection = view.sections.find((s) => s.title === "Galerija");

    assert.ok(gallerySection);
    assert.match(gallerySection.content, /<img/);
  });

  it("shows 'Nema slike' when the product has no main image", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ slika: null }));
    const imageSection = view.sections.find((s) => s.title === "Slika");

    assert.equal(imageSection.content, "Nema slike");
  });

  it("includes a related-products section, listing each one by name, when any are set", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ povezaniProizvodi: [{ id: "p2", naziv: "Krema za lice" }] }));
    const relatedSection = view.sections.find((s) => s.title === "Povezani proizvodi");

    assert.ok(relatedSection);
    assert.deepEqual(relatedSection.items, ["Krema za lice"]);
  });

  it("joins categories and tags into a comma-separated display string", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ kategorije: ["Uređaji", "Nega lica"], tagovi: ["novo"] }));
    const basicSection = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(basicSection.rows.find((r) => r.label === "Kategorije").value, "Uređaji, Nega lica");
    assert.equal(basicSection.rows.find((r) => r.label === "Tagovi").value, "novo");
  });

  it("lists each FAQ entry as a question/answer row", () => {
    const view = prepareProductDetailsData(buildMappedProduct({ faq: [{ pitanje: "Da li radi na struju?", odgovor: "Da." }] }));
    const faqSection = view.sections.find((s) => s.title === "FAQ");

    assert.equal(faqSection.rows[0].label, "Da li radi na struju?");
    assert.equal(faqSection.rows[0].value, "Da.");
  });
});

describe("prepareProductCreateStep1Data", () => {
  it("only asks for name and SKU - description/image/categories are deferred to phase 2", () => {
    const view = prepareProductCreateStep1Data();
    const fieldNames = view.fields.map((f) => f.name);

    assert.deepEqual(fieldNames, ["name", "sku"]);
    assert.equal(view.phaseInfo.current, 1);
    assert.equal(view.phaseInfo.total, 3);
  });
});

describe("prepareProductFormData (single-shot edit)", () => {
  it("includes the shippingClass field with the product's current value preselected", () => {
    const view = prepareProductFormData(buildMappedProduct({ shippingClass: "freight" }));
    const shippingField = view.fields.find((f) => f.name === "shippingClass");

    assert.equal(shippingField.value, "freight");
    assert.deepEqual(
      shippingField.options.map((o) => o.value),
      ["standard", "freight"]
    );
  });

  it("defaults shippingClass to 'standard' when the product doesn't have one set", () => {
    const view = prepareProductFormData(buildMappedProduct({ shippingClass: undefined }));
    const shippingField = view.fields.find((f) => f.name === "shippingClass");

    assert.equal(shippingField.value, "standard");
  });

  it("does not require the image field on edit - a product might already have one", () => {
    const view = prepareProductFormData(buildMappedProduct());
    const imageField = view.fields.find((f) => f.name === "productImage");

    assert.equal(imageField.required, false);
  });

  it("uses multipart/form-data since this form can upload an image", () => {
    const view = prepareProductFormData(buildMappedProduct());
    assert.equal(view.formEnctype, "multipart/form-data");
  });

  it("maps category/tag options into value/label pairs and marks the product's current ones as selected", () => {
    const view = prepareProductFormData(buildMappedProduct({ categories: [{ id: "c1" }], tags: [{ id: "t1" }] }), {
      categoryOptions: [{ id: "c1", naziv: "Uređaji" }],
      tagOptions: [{ id: "t1", naziv: "novo" }],
    });
    const categoriesField = view.fields.find((f) => f.name === "categories");
    const tagsField = view.fields.find((f) => f.name === "tags");

    assert.deepEqual(categoriesField.value, ["c1"]);
    assert.deepEqual(categoriesField.options, [{ value: "c1", label: "Uređaji" }]);
    assert.deepEqual(tagsField.value, ["t1"]);
  });
});

describe("prepareProductDetailsMediaStepData (phase 2)", () => {
  it("requires the image field when the product has no image yet", () => {
    const view = prepareProductDetailsMediaStepData(buildMappedProduct({ image: null }));
    const imageField = view.fields.find((f) => f.name === "productImage");

    assert.equal(imageField.required, true);
  });

  it("does not require the image field again once the product already has one", () => {
    const view = prepareProductDetailsMediaStepData(buildMappedProduct({ image: { url: "/images/products/x.webp", imgDesc: "x" } }));
    const imageField = view.fields.find((f) => f.name === "productImage");

    assert.equal(imageField.required, false);
  });

  it("is phase 2 of 3", () => {
    const view = prepareProductDetailsMediaStepData(buildMappedProduct());
    assert.equal(view.phaseInfo.current, 2);
    assert.equal(view.phaseInfo.total, 3);
  });

  it("does not include a shippingClass field yet - that's phase 3's job", () => {
    const view = prepareProductDetailsMediaStepData(buildMappedProduct());
    assert.ok(!view.fields.some((f) => f.name === "shippingClass"));
  });
});

describe("prepareProductSeoPublishStepData (phase 3)", () => {
  it("is where shippingClass is actually chosen, defaulting to 'standard'", () => {
    const view = prepareProductSeoPublishStepData(buildMappedProduct());
    const shippingField = view.fields.find((f) => f.name === "shippingClass");

    assert.ok(shippingField);
    assert.equal(shippingField.value, "standard");
  });

  it("defaults the publish checkbox to checked - publishing immediately is the common case", () => {
    const view = prepareProductSeoPublishStepData(buildMappedProduct());
    const isActiveField = view.fields.find((f) => f.name === "isActive");

    assert.equal(isActiveField.value, true);
  });

  it("is phase 3 of 3", () => {
    const view = prepareProductSeoPublishStepData(buildMappedProduct());
    assert.equal(view.phaseInfo.current, 3);
    assert.equal(view.phaseInfo.total, 3);
  });

  it("maps related-product options and marks the product's current selections", () => {
    const view = prepareProductSeoPublishStepData(buildMappedProduct({ relatedProducts: [{ id: "p2" }] }), {
      productOptions: [{ id: "p2", naziv: "Krema za lice" }],
    });
    const relatedField = view.fields.find((f) => f.name === "relatedProducts");

    assert.deepEqual(relatedField.value, ["p2"]);
    assert.deepEqual(relatedField.options, [{ value: "p2", label: "Krema za lice" }]);
  });
});

describe("prepareProductSeoFormData", () => {
  it("only exposes the SEO keywords field - a narrow, standalone edit form", () => {
    const view = prepareProductSeoFormData(buildMappedProduct({ seoKljucneReci: ["masaza", "opustanje"] }));

    assert.equal(view.fields.length, 1);
    assert.equal(view.fields[0].value, "masaza, opustanje");
  });
});