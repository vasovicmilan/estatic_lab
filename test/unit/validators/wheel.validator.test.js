import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateWheelSpin, validatePrizeUpdate } from "../../../src/middlewares/validators/wheel.validator.js";

const valid = (o = {}) => ({
  firstName: "Ana",
  lastName: "Anić",
  email: "ana@example.com",
  phone: "064 123 4567",
  segment: "usluge",
  consentContact: true,
  ...o,
});

describe("wheel.validator", () => {
  describe("validateWheelSpin", () => {
    it("accepts a full, valid submission (JSON booleans and form strings alike)", async () => {
      const agent = buildValidatorHarness(validateWheelSpin);
      assert.equal((await agent.post("/test").send(valid())).status, 200);
      assert.equal((await agent.post("/test").send(valid({ consentContact: "true", consentMarketing: "true" }))).status, 200);
      assert.equal((await agent.post("/test").send(valid({ phone: "+381641234567", source: "sajam-ns-2026" }))).status, 200);
    });

    it("requires every field, including phone and the contact consent", async () => {
      const agent = buildValidatorHarness(validateWheelSpin);
      for (const field of ["firstName", "lastName", "email", "phone", "segment"]) {
        const res = await agent.post("/test").send(valid({ [field]: "" }));
        assert.equal(res.status, 400, field);
        assert.ok(res.body.errors[field], field);
      }
      const noConsent = await agent.post("/test").send(valid({ consentContact: false }));
      assert.equal(noConsent.status, 400);
      assert.ok(noConsent.body.errors.consentContact);
    });

    it("rejects a malformed email, a too-short phone and an unknown segment", async () => {
      const agent = buildValidatorHarness(validateWheelSpin);
      assert.ok((await agent.post("/test").send(valid({ email: "nije-mejl" }))).body.errors.email);
      assert.ok((await agent.post("/test").send(valid({ phone: "12345" }))).body.errors.phone);
      assert.ok((await agent.post("/test").send(valid({ phone: "abc def ghij" }))).body.errors.phone);
      assert.ok((await agent.post("/test").send(valid({ segment: "hakeri" }))).body.errors.segment);
    });

    it("only allows a simple source tag (it ends up in a query string and an admin filter)", async () => {
      const agent = buildValidatorHarness(validateWheelSpin);
      assert.ok((await agent.post("/test").send(valid({ source: "<script>" }))).body.errors.source);
      assert.ok((await agent.post("/test").send(valid({ source: "a".repeat(61) }))).body.errors.source);
    });
  });

  describe("validatePrizeUpdate", () => {
    const body = (o = {}) => ({ weight: 10, stock: "5", validDays: 30, ...o });

    it("accepts valid values and an empty stock (= unlimited)", async () => {
      const agent = buildValidatorHarness(validatePrizeUpdate, { method: "put" });
      assert.equal((await agent.put("/test").send(body())).status, 200);
      assert.equal((await agent.put("/test").send(body({ stock: "" }))).status, 200);
      assert.equal((await agent.put("/test").send(body({ stock: "0" }))).status, 200);
    });

    it("rejects a negative chance, a negative stock and a validity outside 1-365 days", async () => {
      const agent = buildValidatorHarness(validatePrizeUpdate, { method: "put" });
      assert.ok((await agent.put("/test").send(body({ weight: -1 }))).body.errors.weight);
      assert.ok((await agent.put("/test").send(body({ stock: "-3" }))).body.errors.stock);
      assert.ok((await agent.put("/test").send(body({ validDays: 0 }))).body.errors.validDays);
      assert.ok((await agent.put("/test").send(body({ validDays: 400 }))).body.errors.validDays);
    });
  });
});
