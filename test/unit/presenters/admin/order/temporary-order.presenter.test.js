import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareTempOrderListData,
  prepareTempOrderDetailsData,
} from "../../../../../src/presenters/admin/order/temporary-order.presenter.js";

// Input shape mirrors mapTemporaryOrderForAdminDetail's real output (see
// temporary-order.mapper.js).
function buildMappedTempOrder(overrides = {}) {
  return {
    id: "order-1",
    korisnik: { ime: "Petar Petrovic", email: "petar@example.com", telefon: "0601234567" },
    adresa: { grad: "Novi Sad", postanskiBroj: "21000", ulica: "Bulevar", broj: "10" },
    stavke: [{ naziv: "ESMA Uredjaj", varijanta: "Standard", kolicina: 1, cena: 250000 }],
    subtotal: 250000,
    dostava: 0,
    zahtevaProceenuDostave: false,
    kupon: null,
    ukupnaCena: 250000,
    napomena: null,
    token: { istice: "02.01.2026. 10:00", istekao: false },
    vreme: { kreirano: "01.01.2026. 10:00" },
    ...overrides,
  };
}

describe("prepareTempOrderListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedTempOrder()], page: 1, totalPages: 2 };
    const view = prepareTempOrderListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("includes a column for whether the order is awaiting a shipping quote", () => {
    const view = prepareTempOrderListData({ data: [], page: 1, totalPages: 1 });
    assert.ok(view.columns.some((c) => c.key === "zahtevaProceenuDostave"));
  });
});

describe("prepareTempOrderDetailsData - freight/shipping-quote handling", () => {
  it("shows the real shipping cost and total for a standard order (no quote needed)", () => {
    const view = prepareTempOrderDetailsData(buildMappedTempOrder({ dostava: 500, ukupnaCena: 250500, zahtevaProceenuDostave: false }));
    const priceSection = view.sections.find((s) => s.title === "Cena");

    assert.equal(priceSection.rows.find((r) => r.label === "Dostava").value, "500 RSD");
    assert.equal(priceSection.rows.find((r) => r.label === "Ukupno").value, "250500 RSD");
  });

  it("shows a waiting-for-quote message instead of a price when the order needs a shipping quote", () => {
    const view = prepareTempOrderDetailsData(buildMappedTempOrder({ zahtevaProceenuDostave: true }));
    const priceSection = view.sections.find((s) => s.title === "Cena");

    assert.match(priceSection.rows.find((r) => r.label === "Dostava").value, /Čeka procenu/);
    assert.match(priceSection.rows.find((r) => r.label === "Ukupno").value, /Zavisi od cene dostave/);
  });

  it("includes the shipping-quote entry form in the sidebar only when a quote is actually needed", () => {
    const withQuote = prepareTempOrderDetailsData(buildMappedTempOrder({ zahtevaProceenuDostave: true }));
    const withoutQuote = prepareTempOrderDetailsData(buildMappedTempOrder({ zahtevaProceenuDostave: false }));

    assert.ok(withQuote.sidebar.some((s) => s.content === "temporary-order-shipping-form"));
    assert.ok(!withoutQuote.sidebar.some((s) => s.content === "temporary-order-shipping-form"));
  });

  it("always includes the customer-confirm action, regardless of shipping-quote status", () => {
    const withQuote = prepareTempOrderDetailsData(buildMappedTempOrder({ zahtevaProceenuDostave: true }));
    const withoutQuote = prepareTempOrderDetailsData(buildMappedTempOrder({ zahtevaProceenuDostave: false }));

    assert.ok(withQuote.sidebar.some((s) => s.content === "temporary-order-confirm-action"));
    assert.ok(withoutQuote.sidebar.some((s) => s.content === "temporary-order-confirm-action"));
  });

  it("shows a placeholder when there's no saved address yet", () => {
    const view = prepareTempOrderDetailsData(buildMappedTempOrder({ adresa: null }));
    const addressSection = view.sections.find((s) => s.title === "Adresa za dostavu");

    assert.equal(addressSection.rows[0].value, "-");
  });

  it("flags an expired confirmation token distinctly from a still-valid one", () => {
    const expired = prepareTempOrderDetailsData(buildMappedTempOrder({ token: { istice: "01.01.2025.", istekao: true } }));
    const valid = prepareTempOrderDetailsData(buildMappedTempOrder({ token: { istice: "01.01.2027.", istekao: false } }));
    const confirmSection = (view) => view.sidebar.find((s) => s.title === "Potvrda");

    assert.match(confirmSection(expired).rows.find((r) => r.label === "Istekao").value, /kupac više ne može/);
    assert.equal(confirmSection(valid).rows.find((r) => r.label === "Istekao").value, "Ne");
  });

  it("lists each cart item with its variant, quantity, and price", () => {
    const view = prepareTempOrderDetailsData(
      buildMappedTempOrder({ stavke: [{ naziv: "Krema za lice", varijanta: "50ml", kolicina: 2, cena: 1500 }] })
    );
    const itemsSection = view.sections.find((s) => s.title === "Stavke");

    assert.equal(itemsSection.rows[0].label, "Krema za lice - 50ml");
    assert.equal(itemsSection.rows[0].value, "2 x 1500 RSD");
  });
});