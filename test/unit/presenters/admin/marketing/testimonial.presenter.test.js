import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareTestimonialListData, prepareTestimonialDetailsData } from "../../../../../src/presenters/admin/marketing/testimonial.presenter.js";

function buildMappedTestimonial(overrides = {}) {
  return {
    id: "test-1",
    osnovno: { ime: "Petar Petrovic", email: "petar@example.com", ocenaZvezdice: 5, komentar: "Odlicno iskustvo!", slika: null },
    usluga: { naziv: "Masaza opustajuca" },
    paket: null,
    korisnik: { ime: "Petar Petrovic" },
    status: { vrednostRaw: "pending", istaknut: false },
    vreme: { kreirano: "01.01.2026.", azurirano: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareTestimonialListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedTestimonial()], page: 1, totalPages: 2 };
    const view = prepareTestimonialListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("has no create/edit actions - testimonials only get viewed and moderated, never authored by admin", () => {
    const view = prepareTestimonialListData({ data: [], page: 1, totalPages: 1 });
    assert.deepEqual(
      view.actions.map((a) => a.type),
      ["view", "delete"]
    );
  });

  it("offers a moderation-status filter and a featured filter, independently", () => {
    const view = prepareTestimonialListData({ data: [], page: 1, totalPages: 1 });

    assert.deepEqual(
      view.topbar.filters.find((f) => f.name === "status").options.map((o) => o.value),
      ["", "pending", "approved", "rejected"]
    );
    assert.deepEqual(
      view.topbar.filters.find((f) => f.name === "isFeatured").options.map((o) => o.value),
      ["", "true", "false"]
    );
  });
});

describe("prepareTestimonialDetailsData", () => {
  it("labels the row 'Usluga' and shows the service name for a service-linked testimonial", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ usluga: { naziv: "Masaza" }, paket: null }));
    const section = view.sections.find((s) => s.title === "Podaci");
    const row = section.rows.find((r) => r.label === "Usluga" || r.label === "Paket");

    assert.equal(row.label, "Usluga");
    assert.equal(row.value, "Masaza");
  });

  it("labels the row 'Paket' and shows the package name for a package-linked testimonial with no service", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ usluga: null, paket: { naziv: "3 masaze" } }));
    const section = view.sections.find((s) => s.title === "Podaci");
    const row = section.rows.find((r) => r.label === "Usluga" || r.label === "Paket");

    assert.equal(row.label, "Paket");
    assert.equal(row.value, "3 masaze");
  });

  it("shows 'Anonimni gost' when the testimonial isn't linked to a real account", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ korisnik: null }));
    const section = view.sections.find((s) => s.title === "Podaci");

    assert.equal(section.rows.find((r) => r.label === "Povezan korisnik").value, "Anonimni gost");
  });

  it("shows 'Nema slike' when there's no submitted photo", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ osnovno: { ime: "Petar", ocenaZvezdice: 5, komentar: "...", slika: null } }));
    assert.equal(view.sections.find((s) => s.title === "Slika").content, "Nema slike");
  });

  it("passes the current moderation status and featured flag through to the moderation form", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ status: { vrednostRaw: "approved", istaknut: true } }));
    const moderationSection = view.sidebar.find((s) => s.title === "Moderacija");

    assert.equal(moderationSection.data.currentStatus, "approved");
    assert.equal(moderationSection.data.isFeatured, true);
  });

  it("uses the reviewer's name as the last breadcrumb", () => {
    const view = prepareTestimonialDetailsData(buildMappedTestimonial({ osnovno: { ime: "Ana Anic", ocenaZvezdice: 4, komentar: "..." } }));
    assert.equal(view.breadcrumbs.at(-1).label, "Ana Anic");
  });
});