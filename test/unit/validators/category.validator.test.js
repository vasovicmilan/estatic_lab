import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateCategoryCreate,
  validateCategoryUpdate,
  validateCategoryId,
} from "../../../src/middlewares/validators/category.validator.js";

function validCategory(overrides = {}) {
  return { name: "Masaze Lica", domain: "service", ...overrides };
}

describe("category.validator", () => {
  describe("validateCategoryCreate", () => {
    it("accepts a minimal valid category", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory());
      assert.equal(res.status, 200);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const { name, ...rest } = validCategory();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a name shorter than 2 characters", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ name: "A" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a domain outside the allowed set", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ domain: "invalid" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.domain);
    });

    it("rejects a missing domain", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const { domain, ...rest } = validCategory();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.domain);
    });

    it("rejects a slug containing uppercase letters or spaces", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ slug: "Not A Slug" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.slug);
    });

    it("accepts a well-formed slug", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ slug: "masaze-lica" }));
      assert.equal(res.status, 200);
    });

    it("rejects a non-mongo-id parent", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ parent: "not-an-id" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.parent);
    });

    it("rejects a shortDescription longer than 300 characters", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ shortDescription: "a".repeat(301) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.shortDescription);
    });

    it("rejects a priority outside 0-999", async () => {
      const agent = buildValidatorHarness(validateCategoryCreate);
      const res = await agent.post("/test").send(validCategory({ priority: 1000 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.priority);
    });
  });

  describe("validateCategoryUpdate", () => {
    it("accepts an empty body (everything optional)", async () => {
      const agent = buildValidatorHarness(validateCategoryUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects an invalid domain when one is given", async () => {
      const agent = buildValidatorHarness(validateCategoryUpdate);
      const res = await agent.post("/test").send({ domain: "invalid" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateCategoryId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateCategoryId, { method: "get", path: "/test/:categoryId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateCategoryId, { method: "get", path: "/test/:categoryId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});