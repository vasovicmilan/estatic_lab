import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareExpertListData, prepareExpertDetailsData, prepareExpertFormData } from "../../../../../src/presenters/admin/auth/expert.presenter.js";

function buildMappedExpert(overrides = {}) {
  return {
    id: "exp-1",
    osnovno: { ime: "Ana", prezime: "Anic", slug: "ana-anic", titula: "Senior terapeut", kratkaBiografija: "..." },
    slika: null,
    specijalizacije: ["Masaze"],
    usluge: ["Masaza opustajuca"],
    aktivan: true,
    redosled: 1,
    drustveneMreze: { instagram: "https://instagram.com/x" },
    vreme: { kreirano: "01.01.2026.", azurirano: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareExpertListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedExpert()], page: 1, totalPages: 2 };
    const view = prepareExpertListData(result, { search: "ana" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("includes an image column for the profile picture", () => {
    const view = prepareExpertListData({ data: [], page: 1, totalPages: 1 });
    assert.ok(view.columns.some((c) => c.key === "slika" && c.type === "image"));
  });
});

describe("prepareExpertDetailsData", () => {
  it("shows 'Nema slike' when the expert has no profile image", () => {
    const view = prepareExpertDetailsData(buildMappedExpert({ slika: null }));
    const imageSection = view.sections.find((s) => s.title === "Slika");

    assert.equal(imageSection.rows[0].value, "Nema slike");
  });

  it("renders an <img> tag when the expert has a profile image", () => {
    const view = prepareExpertDetailsData(buildMappedExpert({ slika: { url: "/images/experts/x.webp", alt: "Ana Anic" } }));
    const imageSection = view.sections.find((s) => s.title === "Slika");

    assert.match(imageSection.rows[0].value, /<img src="\/images\/experts\/x\.webp"/);
  });

  it("combines specializations and services into one flat list", () => {
    const view = prepareExpertDetailsData(buildMappedExpert({ specijalizacije: ["Masaze"], usluge: ["Piling lica"] }));
    const listSection = view.sections.find((s) => s.title === "Specijalizacije i usluge");

    assert.deepEqual(listSection.items, ["Masaze", "Piling lica"]);
  });

  it("shows a placeholder for a missing title/bio", () => {
    const view = prepareExpertDetailsData(
      buildMappedExpert({ osnovno: { ime: "Ana", prezime: "Anic", slug: "ana-anic", titula: null, kratkaBiografija: null } })
    );
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Titula").value, "-");
  });

  it("lists each social link key/value as a row, even for an empty social-links object", () => {
    const withLinks = prepareExpertDetailsData(buildMappedExpert({ drustveneMreze: { instagram: "https://instagram.com/x", facebook: null } }));
    const withoutLinks = prepareExpertDetailsData(buildMappedExpert({ drustveneMreze: {} }));

    const socialSection = withLinks.sidebar.find((s) => s.title === "Društvene mreže");
    assert.equal(socialSection.rows.find((r) => r.label === "facebook").value, "-");
    assert.deepEqual(withoutLinks.sidebar.find((s) => s.title === "Društvene mreže").rows, []);
  });

  it("uses the expert's full name as the last breadcrumb", () => {
    const view = prepareExpertDetailsData(buildMappedExpert({ osnovno: { ime: "Marko", prezime: "Markovic", slug: "marko-markovic" } }));
    assert.equal(view.breadcrumbs.at(-1).label, "Marko Markovic");
  });
});

describe("prepareExpertFormData", () => {
  it("omits the slug field on create, includes it on edit", () => {
    const createView = prepareExpertFormData();
    const editView = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic", slug: "ana-anic" });

    assert.ok(!createView.fields.some((f) => f.name === "slug"));
    assert.ok(editView.fields.some((f) => f.name === "slug"));
  });

  it("requires the image field on create, but not on edit - the expert might already have one", () => {
    const createView = prepareExpertFormData();
    const editView = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic" });

    assert.equal(createView.fields.find((f) => f.name === "expertImage").required, true);
    assert.equal(editView.fields.find((f) => f.name === "expertImage").required, false);
  });

  it("shows the existing image as a preview on edit, none on create", () => {
    const editView = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic", image: { url: "/x.webp" } });
    const createView = prepareExpertFormData();

    assert.equal(editView.fields.find((f) => f.name === "expertImage").preview, "/x.webp");
    assert.equal(createView.fields.find((f) => f.name === "expertImage").preview, null);
  });

  it("joins the specializations array into a comma-separated string for the CSV input", () => {
    const view = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic", specializations: ["Masaze", "Piling"] });
    assert.equal(view.fields.find((f) => f.name === "specializationsCsv").value, "Masaze, Piling");
  });

  it("normalizes a mixed array of populated service objects and raw ids into plain id strings", () => {
    const view = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic", services: [{ id: "s1" }, "s2"] });
    assert.deepEqual(view.fields.find((f) => f.name === "services").value, ["s1", "s2"]);
  });

  it("uses multipart/form-data since this form can upload an image", () => {
    const view = prepareExpertFormData();
    assert.equal(view.formEnctype, "multipart/form-data");
  });

  it("points the form action at POST /admin/eksperti on create, PUT .../:id on edit", () => {
    const createView = prepareExpertFormData();
    const editView = prepareExpertFormData({ id: "e1", firstName: "Ana", lastName: "Anic" });

    assert.equal(createView.formAction, "/admin/eksperti");
    assert.equal(editView.formAction, "/admin/eksperti/e1");
  });
});