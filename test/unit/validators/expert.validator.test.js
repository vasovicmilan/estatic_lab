import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateExpertCreate,
  validateExpertUpdate,
  validateExpertId,
} from "../../../src/middlewares/validators/expert.validator.js";

function validExpert(overrides = {}) {
  return { firstName: "Ana", lastName: "Anic", ...overrides };
}

describe("expert.validator", () => {
  describe("validateExpertCreate", () => {
    it("accepts a minimal valid expert", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert());
      assert.equal(res.status, 200);
    });

    it("rejects a missing firstName", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const { firstName, ...rest } = validExpert();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.firstName);
    });

    it("rejects a missing lastName", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const { lastName, ...rest } = validExpert();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.lastName);
    });

    it("rejects a malformed slug", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert({ slug: "Not Valid" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.slug);
    });

    it("rejects a title longer than 100 characters", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert({ title: "a".repeat(101) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.title);
    });

    it("rejects a non-mongo-id inside the services array", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert({ services: ["not-an-id"] }));
      assert.equal(res.status, 400);
    });

    it("accepts a valid services array", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert({ services: [new Types.ObjectId().toString()] }));
      assert.equal(res.status, 200);
    });

    it("rejects a negative order", async () => {
      const agent = buildValidatorHarness(validateExpertCreate);
      const res = await agent.post("/test").send(validExpert({ order: -1 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.order);
    });
  });

  describe("validateExpertUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateExpertUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });
  });

  describe("validateExpertId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateExpertId, { method: "get", path: "/test/:expertId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateExpertId, { method: "get", path: "/test/:expertId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});