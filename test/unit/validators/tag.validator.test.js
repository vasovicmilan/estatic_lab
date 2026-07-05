import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateTagCreate, validateTagUpdate, validateTagId } from "../../../src/middlewares/validators/tag.validator.js";

function validTag(overrides = {}) {
  return { name: "Opustanje", domain: "service", ...overrides };
}

describe("tag.validator", () => {
  describe("validateTagCreate", () => {
    it("accepts a minimal valid tag", async () => {
      const agent = buildValidatorHarness(validateTagCreate);
      const res = await agent.post("/test").send(validTag());
      assert.equal(res.status, 200);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validateTagCreate);
      const { name, ...rest } = validTag();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a name longer than 50 characters", async () => {
      const agent = buildValidatorHarness(validateTagCreate);
      const res = await agent.post("/test").send(validTag({ name: "a".repeat(51) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a domain outside the allowed set", async () => {
      const agent = buildValidatorHarness(validateTagCreate);
      const res = await agent.post("/test").send(validTag({ domain: "invalid" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.domain);
    });

    it("rejects a malformed slug", async () => {
      const agent = buildValidatorHarness(validateTagCreate);
      const res = await agent.post("/test").send(validTag({ slug: "Not Valid!" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.slug);
    });
  });

  describe("validateTagUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateTagUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });
  });

  describe("validateTagId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateTagId, { method: "get", path: "/test/:tagId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateTagId, { method: "get", path: "/test/:tagId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});