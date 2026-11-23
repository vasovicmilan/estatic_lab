import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEur, formatEur, formatEurRange, validateEurPair } from "../../../src/utils/eur-price.util.js";

describe("eur-price.util", () => {
  it("normalizeEur: prazno i smeće daje null, broj ostaje", () => {
    assert.equal(normalizeEur(""), null);
    assert.equal(normalizeEur(null), null);
    assert.equal(normalizeEur(undefined), null);
    assert.equal(normalizeEur("abc"), null);
    assert.equal(normalizeEur("12,5"), 12.5);
    assert.equal(normalizeEur(0), 0);
  });

  it("formatEur: cele vrednosti bez decimala, ostale sa zarezom, prazno je null", () => {
    assert.equal(formatEur(21), "21 €");
    assert.equal(formatEur(12.5), "12,50 €");
    assert.equal(formatEur(null), null);
    assert.equal(formatEur(0), null);
    assert.equal(formatEur(""), null);
  });

  it("formatEurRange: opseg samo ako sve stavke imaju EUR cenu", () => {
    assert.equal(formatEurRange([20, 30]), "20 - 30 €");
    assert.equal(formatEurRange([20, 20]), "20 €");
    assert.equal(formatEurRange([20, null]), null);
    assert.equal(formatEurRange([]), null);
  });

  it("validateEurPair: stara cena traži cenu, negativne i nenumeričke vrednosti se odbijaju", () => {
    assert.equal(validateEurPair({ price: "", oldPrice: "" }), null);
    assert.equal(validateEurPair({ price: 10, oldPrice: 15 }), null);
    assert.match(validateEurPair({ price: "", oldPrice: 15 }, "V1"), /traži i cenu/);
    assert.match(validateEurPair({ price: -1 }, "V1"), /negativna/);
    assert.match(validateEurPair({ price: "x" }, "V1"), /mora biti broj/);
  });
});
