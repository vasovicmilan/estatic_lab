import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareContactListData, prepareContactDetailsData } from "../../../../../src/presenters/admin/marketing/contact.presenter.js";

function buildMappedContact(overrides = {}) {
  return {
    id: "contact-1",
    osnovno: { ime: "Petar", prezime: "Petrovic", email: "petar@example.com", telefon: "0601234567", tema: "Pitanje", statusRaw: "new" },
    poruka: "Zdravo, imam pitanje...",
    referalniKod: null,
    vreme: { kreirano: "01.01.2026.", azurirano: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareContactListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedContact()], page: 1, totalPages: 2 };
    const view = prepareContactListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("has no create/edit/delete actions - only viewing an inbound message", () => {
    const view = prepareContactListData({ data: [], page: 1, totalPages: 1 });
    assert.deepEqual(
      view.actions.map((a) => a.type),
      ["view"]
    );
  });

  it("offers all 4 message statuses as filter options", () => {
    const view = prepareContactListData({ data: [], page: 1, totalPages: 1 });
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");

    assert.deepEqual(statusFilter.options.map((o) => o.value), ["", "new", "read", "replied", "archived"]);
  });
});

describe("prepareContactDetailsData", () => {
  it("omits the referral-code section entirely for a message with no referral code", () => {
    const view = prepareContactDetailsData(buildMappedContact({ referalniKod: null }));
    assert.ok(!view.sidebar.some((s) => s.title === "Referalni kod"));
  });

  it("shows the referral code when the message came in through a partner link", () => {
    const view = prepareContactDetailsData(buildMappedContact({ referalniKod: "PETAR10" }));
    const referralSection = view.sidebar.find((s) => s.title === "Referalni kod");

    assert.ok(referralSection);
    assert.equal(referralSection.rows.find((r) => r.label === "Kod").value, "PETAR10");
  });

  it("shows a placeholder for a missing phone/topic", () => {
    const view = prepareContactDetailsData(
      buildMappedContact({ osnovno: { ime: "Petar", prezime: "Petrovic", email: "petar@example.com", telefon: null, tema: null, statusRaw: "new" } })
    );
    const section = view.sections.find((s) => s.title === "Pošiljalac");

    assert.equal(section.rows.find((r) => r.label === "Telefon").value, "-");
    assert.equal(section.rows.find((r) => r.label === "Tema").value, "-");
  });

  it("offers only read/replied/archived status options - never back to 'new'", () => {
    const view = prepareContactDetailsData(buildMappedContact());
    const statusSection = view.sidebar.find((s) => s.title === "Status");

    assert.deepEqual(
      statusSection.data.options.map((o) => o.value),
      ["read", "replied", "archived"]
    );
  });

  it("uses the sender's first name as the last breadcrumb", () => {
    const view = prepareContactDetailsData(buildMappedContact({ osnovno: { ime: "Ana", prezime: "Anic", email: "a@example.com", statusRaw: "new" } }));
    assert.equal(view.breadcrumbs.at(-1).label, "Ana");
  });
});