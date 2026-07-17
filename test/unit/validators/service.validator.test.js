import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateServiceStep1,
  validateServicePackagesStep,
  validateServiceExtrasStep,
  validateServiceUpdate,
  validateServiceSeo,
  validateServiceId,
} from "../../../src/middlewares/validators/service.validator.js";

describe("service.validator", () => {
  describe("validateServiceStep1", () => {
    it("accepts core info with no packages field at all - that's phase 2's job now", async () => {
      const agent = buildValidatorHarness(validateServiceStep1);
      const res = await agent.post("/test").send({ name: "Sportska Masaza" });
      assert.equal(res.status, 200);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validateServiceStep1);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a defaultDuration under 5 minutes", async () => {
      const agent = buildValidatorHarness(validateServiceStep1);
      const res = await agent.post("/test").send({ name: "X", defaultDuration: 2 });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.defaultDuration);
    });

    it("rejects a shortDescription over 300 characters", async () => {
      const agent = buildValidatorHarness(validateServiceStep1);
      const res = await agent.post("/test").send({ name: "X", shortDescription: "a".repeat(301) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.shortDescription);
    });

    it("rejects a malformed slug when one is given", async () => {
      const agent = buildValidatorHarness(validateServiceStep1);
      const res = await agent.post("/test").send({ name: "X", slug: "Not Valid" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateServicePackagesStep", () => {
    it("accepts a real array of packages", async () => {
      const agent = buildValidatorHarness(validateServicePackagesStep);
      const res = await agent.post("/test").send({ packages: [{ name: "60 min", duration: 60, totalPrice: 3000 }] });
      assert.equal(res.status, 200);
    });

    it("accepts packages sent as a JSON string", async () => {
      const agent = buildValidatorHarness(validateServicePackagesStep);
      const res = await agent
        .post("/test")
        .send({ packages: JSON.stringify([{ name: "60 min", duration: 60, totalPrice: 3000 }]) });
      assert.equal(res.status, 200);
    });

    it("rejects a missing packages field - this is now the ONE hard requirement to publish", async () => {
      const agent = buildValidatorHarness(validateServicePackagesStep);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.packages);
    });

    it("rejects packages that are neither an array nor valid JSON", async () => {
      const agent = buildValidatorHarness(validateServicePackagesStep);
      const res = await agent.post("/test").send({ packages: "garbage" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.packages);
    });
  });

  describe("validateServiceExtrasStep", () => {
    it("accepts a completely empty body - everything here is optional", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects a malformed features field", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({ features: "not-json" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.features);
    });

    it("rejects a malformed comparisonTable field", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({ comparisonTable: "not-json" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.comparisonTable);
    });

    it("rejects a malformed faq field", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({ faq: "not-json" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.faq);
    });

    it("accepts isActive as '1' - what the admin checkbox markup actually sends when checked", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({ isActive: "1" });
      assert.equal(res.status, 200);
    });

    it("accepts isActive as '0' - the hidden fallback input for unchecked", async () => {
      const agent = buildValidatorHarness(validateServiceExtrasStep);
      const res = await agent.post("/test").send({ isActive: "0" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateServiceUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateServiceUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects a malformed slug when one is given", async () => {
      const agent = buildValidatorHarness(validateServiceUpdate);
      const res = await agent.post("/test").send({ slug: "Not Valid" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateServiceSeo", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateServiceSeo);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });
  });

  describe("validateServiceId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateServiceId, { method: "get", path: "/test/:serviceId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateServiceId, { method: "get", path: "/test/:serviceId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});