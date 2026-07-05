import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateTestimonialSubmit,
  validateTestimonialApprove,
  validateTestimonialId,
} from "../../../src/middlewares/validators/testimonial.validator.js";

function validSubmission(overrides = {}) {
  return {
    name: "Milica",
    rating: 5,
    message: "Odlicno iskustvo, toplo preporucujem svima koji trebaju masazu.",
    ...overrides,
  };
}

describe("testimonial.validator", () => {
  describe("validateTestimonialSubmit", () => {
    it("accepts a valid submission", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission());
      assert.equal(res.status, 200);
    });

    it("rejects a name shorter than 2 characters", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission({ name: "A" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a rating outside 1-5", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission({ rating: 6 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.rating);
    });

    it("rejects a message shorter than 10 characters", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission({ message: "Kratko" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.message);
    });

    it("rejects an invalid email when one is given", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission({ email: "not-an-email" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("accepts a missing email (optional)", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission());
      assert.equal(res.status, 200);
    });

    it("rejects a non-mongo-id service when one is given", async () => {
      const agent = buildValidatorHarness(validateTestimonialSubmit);
      const res = await agent.post("/test").send(validSubmission({ service: "not-an-id" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.service);
    });
  });

  describe("validateTestimonialApprove", () => {
    it("accepts an empty body (isFeatured is optional)", async () => {
      const agent = buildValidatorHarness(validateTestimonialApprove);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects an invalid isFeatured value", async () => {
      const agent = buildValidatorHarness(validateTestimonialApprove);
      const res = await agent.post("/test").send({ isFeatured: "maybe" });
      assert.equal(res.status, 400);
    });

    it("accepts a boolean-like isFeatured value", async () => {
      const agent = buildValidatorHarness(validateTestimonialApprove);
      const res = await agent.post("/test").send({ isFeatured: "true" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateTestimonialId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateTestimonialId, { method: "get", path: "/test/:testimonialId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateTestimonialId, { method: "get", path: "/test/:testimonialId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});