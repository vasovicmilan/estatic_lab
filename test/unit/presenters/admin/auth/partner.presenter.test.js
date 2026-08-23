import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preparePartnerListData,
  preparePartnerDetailsData,
  preparePartnerFormData,
} from "../../../../../src/presenters/admin/auth/partner.presenter.js";

// Presenters are pure functions - no DB, no mocks needed, same reasoning as the
// mapper tests. Input shapes mirror what mapPartnerForAdminDetail/mapPartnerForEdit
// actually produce (see partner.mapper.js), not the raw Mongoose document -
// presenters only ever receive already-mapped data.

function buildMappedPartner(overrides = {}) {
  return {
    id: "partner-1",
    korisnik: { imePrezime: "Petar Petrovic", email: "petar@example.com", telefon: "0601234567" },
    procenatProvizijeUsluge: "12%",
    procenatProvizijeArtikli: "4%",
    maxProvizijaUsluge: "Bez ogranicenja",
    maxProvizijaArtikli: "20000 RSD",
    aktivan: "Da",
    napomena: null,
    vreme: { kreiran: "01.01.2026. 10:00", azuriran: "01.01.2026. 10:00" },
    ...overrides,
  };
}

describe("preparePartnerListData", () => {
  it("carries the result's items and pagination through unmodified", () => {
    const result = { data: [buildMappedPartner()], page: 2, totalPages: 5 };
    const view = preparePartnerListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.currentPage, 2);
    assert.equal(view.pagination.totalPages, 5);
    assert.equal(view.topbar.search, "petar");
  });

  it("exposes separate columns for the services and products commission rates - not one combined column", () => {
    const view = preparePartnerListData({ data: [], page: 1, totalPages: 1 });
    const keys = view.columns.map((c) => c.key);

    assert.ok(keys.includes("procenatProvizijeUsluge"));
    assert.ok(keys.includes("procenatProvizijeArtikli"));
  });
});

describe("preparePartnerDetailsData", () => {
  it("shows both commission rates and both caps in the sidebar status table", () => {
    const partner = buildMappedPartner();
    const view = preparePartnerDetailsData(partner);

    const statusSection = view.sidebar.find((s) => s.title === "Status");
    const rowLabels = statusSection.rows.map((r) => r.label);
    assert.ok(rowLabels.includes("Provizija - usluge/paketi"));
    assert.ok(rowLabels.includes("Provizija - artikli"));
    assert.ok(rowLabels.includes("Max. provizija po transakciji - usluge/paketi"));
    assert.ok(rowLabels.includes("Max. provizija po transakciji - artikli"));
  });

  it("omits the balance/payout sidebar cards entirely when no balance is passed", () => {
    const view = preparePartnerDetailsData(buildMappedPartner());
    const titles = view.sidebar.map((s) => s.title);

    assert.ok(!titles.includes("Stanje"));
    assert.ok(!titles.includes("Zabelezi isplatu"));
  });

  it("shows the balance breakdown and a payout-record form when a balance is passed", () => {
    const balance = { earned: 5000, paid: 2000, reserved: 500, available: 2500 };
    const view = preparePartnerDetailsData(buildMappedPartner(), balance);

    const balanceSection = view.sidebar.find((s) => s.title === "Stanje");
    assert.ok(balanceSection);
    assert.ok(balanceSection.rows.some((r) => r.value === "2500 RSD" && r.label === "Raspoloživo za isplatu"));

    const payoutForm = view.sidebar.find((s) => s.title === "Zabeleži isplatu");
    assert.equal(payoutForm.data.earnerType, "partner");
    assert.equal(payoutForm.data.earnerId, "partner-1");
  });

  it("shows a 'create a coupon' prompt when the partner has no referral codes yet", () => {
    const view = preparePartnerDetailsData(buildMappedPartner(), null, []);
    const couponsSection = view.sections.find((s) => s.title === "Referalni kodovi");

    assert.equal(couponsSection.rows.length, 1);
    assert.match(couponsSection.rows[0].value, /Kreiraj kupon/);
  });

  it("lists each referral coupon with its discount and active status", () => {
    const coupons = [{ id: "c1", code: "PETAR10", discountType: "percentage", discountValue: 10, isActive: true }];
    const view = preparePartnerDetailsData(buildMappedPartner(), null, coupons);
    const couponsSection = view.sections.find((s) => s.title === "Referalni kodovi");

    assert.equal(couponsSection.rows[0].label, "PETAR10");
    assert.match(couponsSection.rows[0].value, /10%/);
  });

  it("translates each commission entry's source type and status for display", () => {
    const commissions = [{ sourceType: "order", baseValue: 20000, rate: 5, amount: 1000, status: "pending" }];
    const view = preparePartnerDetailsData(buildMappedPartner(), null, [], commissions);
    const commissionsSection = view.sections.find((s) => s.title === "Poslednje provizije");

    assert.match(commissionsSection.rows[0].label, /Porudžbina/);
    assert.match(commissionsSection.rows[0].value, /Na čekanju/);
  });
});

describe("preparePartnerFormData", () => {
  it("includes the userId select only on create, not on edit", () => {
    const createView = preparePartnerFormData(null, { userOptions: [{ value: "u1", label: "Petar" }] });
    const editView = preparePartnerFormData({ id: "p1", commissionRateServices: 10, commissionRateProducts: 5 });

    assert.ok(createView.fields.some((f) => f.name === "userId"));
    assert.ok(!editView.fields.some((f) => f.name === "userId"));
  });

  it("exposes commissionRateServices and commissionRateProducts as two separate required fields", () => {
    const view = preparePartnerFormData(null, {});
    const servicesField = view.fields.find((f) => f.name === "commissionRateServices");
    const productsField = view.fields.find((f) => f.name === "commissionRateProducts");

    assert.ok(servicesField.required);
    assert.ok(productsField.required);
    assert.equal(servicesField.max, 100);
    assert.equal(productsField.max, 100);
  });

  it("exposes both max commission amount caps as optional (not required) fields", () => {
    const view = preparePartnerFormData(null, {});
    const capServices = view.fields.find((f) => f.name === "maxCommissionAmountServices");
    const capProducts = view.fields.find((f) => f.name === "maxCommissionAmountProducts");

    assert.ok(!capServices.required);
    assert.ok(!capProducts.required);
  });

  it("points the form action at POST /admin/partneri on create, PUT .../:id on edit", () => {
    const createView = preparePartnerFormData(null, {});
    const editView = preparePartnerFormData({ id: "p1", commissionRateServices: 10, commissionRateProducts: 5 });

    assert.equal(createView.formAction, "/admin/partneri");
    assert.equal(editView.formAction, "/admin/partneri/p1");
    assert.equal(createView.isEdit, false);
    assert.equal(editView.isEdit, true);
  });
});