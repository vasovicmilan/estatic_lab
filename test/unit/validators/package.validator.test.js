import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validatePackageCreate,
  validatePackageUpdate,
  validatePackageId,
} from "../../../src/middlewares/validators/package.validator.js";

function validPackage(overrides = {}) {
  return {
    name: "Dan Za Sebe",
    description: "Kombinovani paket usluga",
    items: [{ service: new Types.ObjectId().toString(), sessions: 1 }],
    totalPrice: 8000,
    ...overrides,
  };
}

describe("package.validator", () => {
  describe("validatePackageCreate", () => {
    it("accepts a fully valid package with a real array of items", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const res = await agent.post("/test").send(validPackage());
      assert.equal(res.status, 200);
    });

    it("accepts items sent as a JSON string (multipart form submission)", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const res = await agent
        .post("/test")
        .send(validPackage({ items: JSON.stringify([{ service: new Types.ObjectId().toString(), sessions: 1 }]) }));
      assert.equal(res.status, 200);
    });

    it("rejects items that are neither an array nor valid JSON", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const res = await agent.post("/test").send(validPackage({ items: "not-json-or-array" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.items);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const { name, ...rest } = validPackage();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a missing description", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const { description, ...rest } = validPackage();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.description);
    });

    it("rejects a negative totalPrice", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const res = await agent.post("/test").send(validPackage({ totalPrice: -100 }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.totalPrice);
    });

    it("rejects a malformed slug", async () => {
      const agent = buildValidatorHarness(validatePackageCreate);
      const res = await agent.post("/test").send(validPackage({ slug: "Not Valid" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.slug);
    });
  });

  describe("validatePackageUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validatePackageUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });
  });

  describe("validatePackageId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validatePackageId, { method: "get", path: "/test/:packageId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validatePackageId, { method: "get", path: "/test/:packageId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});