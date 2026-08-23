import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preparePackagePurchaseListData,
  preparePackagePurchaseDetailsData,
  preparePackagePurchaseFormData,
  preparePackagePurchaseEditFormData,
} from "../../../../../src/presenters/admin/marketing/package-purchase.presenter.js";

function buildMappedPurchase(overrides = {}) {
  return {
    id: "purchase-1",
    korisnik: "Petar Petrovic",
    korisnikEmail: "petar@example.com",
    paket: "3 masaze",
    status: "Aktivan",
    napomena: null,
    stavke: [{ usluga: "Masaza", varijanta: "Standard", iskorisceno: 1, rezervisano: 0, ukupnoSeansi: 3, preostalo: 2 }],
    originalnaCena: 9000,
    popust: 500,
    placeno: 8500,
    expiresAtRaw: "",
    vreme: { kupljeno: "01.01.2026. 10:00", istice: "-" },
    ...overrides,
  };
}

describe("preparePackagePurchaseListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedPurchase()], page: 1, totalPages: 2 };
    const view = preparePackagePurchaseListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("carries a userId query param through into the 'assign package' create link - prefilling the customer", () => {
    const view = preparePackagePurchaseListData({ data: [], page: 1, totalPages: 1 }, { userId: "u1" });
    assert.equal(view.topbar.createUrl, "/admin/kupljeni-paketi/dodavanje?userId=u1");
  });

  it("uses the plain create link when no userId is in the query", () => {
    const view = preparePackagePurchaseListData({ data: [], page: 1, totalPages: 1 });
    assert.equal(view.topbar.createUrl, "/admin/kupljeni-paketi/dodavanje");
  });
});

describe("preparePackagePurchaseDetailsData", () => {
  it("shows each package item's used/reserved/total/remaining session counts", () => {
    const view = preparePackagePurchaseDetailsData(buildMappedPurchase());
    const itemsSection = view.sections.find((s) => s.title === "Usluge u paketu");

    assert.equal(itemsSection.rows[0].label, "Masaza - Standard");
    assert.match(itemsSection.rows[0].value, /1 iskorišćeno, 0 rezervisano \/ 3 ukupno \(2 slobodno\)/);
  });

  it("shows the price breakdown - original, discount, and what was actually paid", () => {
    const view = preparePackagePurchaseDetailsData(buildMappedPurchase({ originalnaCena: 9000, popust: 500, placeno: 8500 }));
    const priceSection = view.sidebar.find((s) => s.title === "Cena");

    assert.equal(priceSection.rows.find((r) => r.label === "Originalna cena").value, "9000 RSD");
    assert.equal(priceSection.rows.find((r) => r.label === "Plaćeno").value, "8500 RSD");
  });

  it("uses the package name as the last breadcrumb", () => {
    const view = preparePackagePurchaseDetailsData(buildMappedPurchase({ paket: "5 masaza" }));
    assert.equal(view.breadcrumbs.at(-1).label, "5 masaza");
  });
});

describe("preparePackagePurchaseFormData (assign)", () => {
  it("builds a packageId select-preview field with a live preview payload keyed by package id", () => {
    const packages = [{ id: "pkg1", naziv: "3 masaze", cena: 9000, stavke: ["Masaza x3"] }];
    const view = preparePackagePurchaseFormData({ packages });
    const packageField = view.fields.find((f) => f.name === "packageId");

    assert.equal(packageField.type, "select-preview");
    assert.deepEqual(packageField.options, [{ value: "pkg1", label: "3 masaze" }]);
    assert.deepEqual(packageField.previewData.pkg1, { cena: 9000, stavke: ["Masaza x3"] });
  });

  it("builds a separate preview entry for each package, keyed correctly by its own id", () => {
    const packages = [
      { id: "pkg1", naziv: "3 masaze", cena: 9000, stavke: ["Masaza x3"] },
      { id: "pkg2", naziv: "5 masaza", cena: 14000, stavke: ["Masaza x5"] },
    ];
    const view = preparePackagePurchaseFormData({ packages });

    assert.equal(view.fields.find((f) => f.name === "packageId").previewData.pkg2.cena, 14000);
  });

  it("prefills the userId field and redirects cancel back to that customer's profile when a prefillUserId is given", () => {
    const view = preparePackagePurchaseFormData({ prefillUserId: "u1" });
    const userField = view.fields.find((f) => f.name === "userId");

    assert.equal(userField.value, "u1");
    assert.equal(view.cancelUrl, "/admin/korisnici/detalji/u1");
  });

  it("cancels back to the package-purchase list when there's no prefilled customer", () => {
    const view = preparePackagePurchaseFormData({});
    assert.equal(view.cancelUrl, "/admin/kupljeni-paketi");
  });
});

describe("preparePackagePurchaseEditFormData", () => {
  it("only exposes expiresAt and notes - the purchased items/pricing/coupon stay immutable", () => {
    const view = preparePackagePurchaseEditFormData(buildMappedPurchase());
    const fieldNames = view.fields.map((f) => f.name);

    assert.deepEqual(fieldNames.sort(), ["expiresAt", "notes"].sort());
  });

  it("cancels back to the purchase's own detail page, not the list", () => {
    const view = preparePackagePurchaseEditFormData(buildMappedPurchase({ id: "purchase-1" }));
    assert.equal(view.cancelUrl, "/admin/kupljeni-paketi/detalji/purchase-1");
  });
});