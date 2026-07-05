import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateNewsletterSubscribe, validateSubscriberId } from "../../../src/middlewares/validators/newsletter.validator.js";

describe("newsletter.validator", () => {
  describe("validateNewsletterSubscribe", () => {
    it("rejects a missing email", async () => {
      const agent = buildValidatorHarness(validateNewsletterSubscribe);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("rejects an invalid email format", async () => {
      const agent = buildValidatorHarness(validateNewsletterSubscribe);
      const res = await agent.post("/test").send({ email: "not-an-email" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("accepts a valid email", async () => {
      const agent = buildValidatorHarness(validateNewsletterSubscribe);
      const res = await agent.post("/test").send({ email: "test@example.com" });
      assert.equal(res.status, 200);
      assert.equal(res.body.errors, null);
    });
  });

  describe("validateSubscriberId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateSubscriberId, { method: "get", path: "/test/:subscriberId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.subscriberId);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateSubscriberId, { method: "get", path: "/test/:subscriberId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.errors, null);
    });
  });
});