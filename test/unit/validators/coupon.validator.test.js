import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateCouponCreate,
  validateCouponUpdate,
  validateCouponApply,
  validateCouponId,
} from "../../../src/middlewares/validators/coupon.validator.js";

function validCoupon(overrides = {}) {
  return {
    code: "DOBRODOSLI10",
    discountType: "percentage",
    discountValue: 10,
    validUntil: new Date().toISOString(),
    ...overrides,
  };
}

describe("coupon.validator", () => {
  describe("validateCouponCreate", () => {
    it("accepts a fully valid coupon", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon());
      assert.equal(res.status, 200);
    });

    it("rejects a code shorter than 3 characters", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ code: "AB" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.code);
    });

    it("rejects a code with invalid characters", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ code: "KOD!!" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.code);
    });

    it("rejects a discountType outside percentage/fixed", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ discountType: "other" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.discountType);
    });

    it("rejects a negative discountValue", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ discountValue: -5 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.discountValue);
    });

    it("rejects a missing validUntil", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const { validUntil, ...rest } = validCoupon();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.validUntil);
    });

    it("rejects a malformed validUntil date", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ validUntil: "not-a-date" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.validUntil);
    });

    it("rejects a negative maxUses when one is given", async () => {
      // note: maxUses uses optional({ values: "falsy" }) so 0 would be skipped entirely — use -1
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ maxUses: -1 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.maxUses);
    });

    it("rejects a negative maxUsesPerUser when one is given", async () => {
      const agent = buildValidatorHarness(validateCouponCreate);
      const res = await agent.post("/test").send(validCoupon({ maxUsesPerUser: -1 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.maxUsesPerUser);
    });
  });

  describe("validateCouponUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateCouponUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects an invalid discountType when one is given", async () => {
      const agent = buildValidatorHarness(validateCouponUpdate);
      const res = await agent.post("/test").send({ discountType: "invalid" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateCouponApply", () => {
    it("rejects a missing code", async () => {
      const agent = buildValidatorHarness(validateCouponApply);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.code);
    });

    it("accepts any non-empty code", async () => {
      const agent = buildValidatorHarness(validateCouponApply);
      const res = await agent.post("/test").send({ code: "kodkod" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateCouponId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateCouponId, { method: "get", path: "/test/:couponId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateCouponId, { method: "get", path: "/test/:couponId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});