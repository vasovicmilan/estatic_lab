import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roundMoney } from "../../../src/utils/money.util.js";

describe("money.util", () => {
  describe("roundMoney", () => {
    it("rounds to 2 decimal places", () => {
      assert.equal(roundMoney(1.005), 1.01);
      assert.equal(roundMoney(2.675), 2.68);
    });

    it("corrects the classic 0.1 + 0.2 floating point drift", () => {
      // 0.1 + 0.2 === 0.30000000000000004 in raw floating point math
      assert.equal(roundMoney(0.1 + 0.2), 0.3);
    });

    it("leaves an already-exact 2-decimal value unchanged", () => {
      assert.equal(roundMoney(2400), 2400);
      assert.equal(roundMoney(216.5), 216.5);
    });

    it("correctly rounds a repeating-decimal pro-rating result (real commission.service.js shape)", () => {
      // 5000 * (16000 / 19000) = 4210.526315789...
      const value = 5000 * (16000 / 19000);
      assert.equal(roundMoney(value), 4210.53);
    });

    it("treats non-numeric/undefined input as 0 rather than throwing or returning NaN", () => {
      assert.equal(roundMoney(undefined), 0);
      assert.equal(roundMoney(null), 0);
      assert.equal(roundMoney("not a number"), 0);
    });

    it("rounds negative values correctly", () => {
      assert.equal(roundMoney(-1.005), -1);
    });
  });
});
