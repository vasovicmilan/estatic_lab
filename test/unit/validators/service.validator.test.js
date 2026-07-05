import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateServiceCreate,
  validateServiceUpdate,
  validateServiceSeo,
  validateServiceId,
} from "../../../src/middlewares/validators/service.validator.js";

function validService(overrides = {}) {
  return {
    name: "Sportska Masaza",
    packages: [{ name: "60 min", duration: 60, totalPrice: 3000 }],
    ...overrides,
  };
}

describe("service.validator", () => {
  describe("validateServiceCreate", () => {
    it("accepts a fully valid service", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent.post("/test").send(validService());
      assert.equal(res.status, 200);
    });

    it("accepts packages sent as a JSON string", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent
        .post("/test")
        .send(validService({ packages: JSON.stringify([{ name: "60 min", duration: 60, totalPrice: 3000 }]) }));
      assert.equal(res.status, 200);
    });

    it("rejects a missing packages field", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const { packages, ...rest } = validService();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.packages);
    });

    it("rejects packages that are neither an array nor valid JSON", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent.post("/test").send(validService({ packages: "garbage" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.packages);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const { name, ...rest } = validService();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a defaultDuration under 5 minutes", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent.post("/test").send(validService({ defaultDuration: 2 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.defaultDuration);
    });

    it("rejects a malformed features field", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent.post("/test").send(validService({ features: "not-json" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.features);
    });

    it("rejects a shortDescription over 300 characters", async () => {
      const agent = buildValidatorHarness(validateServiceCreate);
      const res = await agent.post("/test").send(validService({ shortDescription: "a".repeat(301) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.shortDescription);
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