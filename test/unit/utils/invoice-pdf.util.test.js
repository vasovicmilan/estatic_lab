import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateOrderInvoicePdf } from "../../../src/utils/invoice-pdf.util.js";
import { buildOrder, buildOrderItem } from "../../helpers/factories.js";

function orderFixture(overrides = {}) {
  return {
    id: "abc123",
    datum: "19.07.2026.",
    korisnik: { ime: "Petar Petrović", email: "petar@example.com", telefon: "0601234567" },
    adresa: { ulica: "Bulevar Oslobođenja", broj: "10", grad: "Novi Sad", postanskiBroj: "21000" },
    stavke: [{ naziv: "ESMA Uređaj", varijanta: "Standard", cena: 25000, kolicina: 1, ukupno: 25000 }],
    subtotal: 25000,
    dostava: 350,
    kupon: null,
    popust: 0,
    ukupnaCena: "25350.00 RSD",
    ...overrides,
  };
}

describe("invoice-pdf.util", () => {
  it("generates a valid PDF buffer", async () => {
    const buffer = await generateOrderInvoicePdf(orderFixture());
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.slice(0, 4).toString(), "%PDF", "should start with the PDF file signature");
    assert.ok(buffer.length > 500, "a real invoice PDF shouldn't be a near-empty stub");
  });

  it("does not throw for an order with multiple line items", async () => {
    const order = orderFixture({
      stavke: [
        { naziv: "ESMA Uređaj", varijanta: "Standard", cena: 25000, kolicina: 1, ukupno: 25000 },
        { naziv: "Gel za tretman", varijanta: "200ml", cena: 1500, kolicina: 2, ukupno: 3000 },
      ],
    });
    const buffer = await generateOrderInvoicePdf(order);
    assert.ok(Buffer.isBuffer(buffer));
  });

  it("does not throw when a coupon was applied", async () => {
    const buffer = await generateOrderInvoicePdf(orderFixture({ kupon: "LETO10", popust: 2500 }));
    assert.ok(Buffer.isBuffer(buffer));
  });

  it("does not throw when the address is missing", async () => {
    const buffer = await generateOrderInvoicePdf(orderFixture({ adresa: null }));
    assert.ok(Buffer.isBuffer(buffer));
  });

  it("does not throw for an order with no line items", async () => {
    const buffer = await generateOrderInvoicePdf(orderFixture({ stavke: [] }));
    assert.ok(Buffer.isBuffer(buffer));
  });
});