import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateUserStatus,
  validateUserRole,
  validateUserId,
  validateProfileUpdate,
} from "../../../src/middlewares/validators/user.validator.js";

describe("user.validator", () => {
  describe("validateUserStatus", () => {
    it("rejects a missing status", async () => {
      const agent = buildValidatorHarness(validateUserStatus);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.status);
    });

    it("rejects a status outside the allowed enum", async () => {
      const agent = buildValidatorHarness(validateUserStatus);
      const res = await agent.post("/test").send({ status: "banned" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.status);
    });

    it("accepts a valid status", async () => {
      const agent = buildValidatorHarness(validateUserStatus);
      const res = await agent.post("/test").send({ status: "active" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateUserRole", () => {
    it("rejects a missing role", async () => {
      const agent = buildValidatorHarness(validateUserRole);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.role);
    });

    it("rejects a non-mongo-id role", async () => {
      const agent = buildValidatorHarness(validateUserRole);
      const res = await agent.post("/test").send({ role: "not-an-id" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.role);
    });

    it("accepts a valid mongo id role", async () => {
      const agent = buildValidatorHarness(validateUserRole);
      const res = await agent.post("/test").send({ role: new Types.ObjectId().toString() });
      assert.equal(res.status, 200);
    });
  });

  describe("validateUserId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateUserId, { method: "get", path: "/test/:userId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateUserId, { method: "get", path: "/test/:userId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });

  describe("validateProfileUpdate", () => {
    it("accepts an empty body (everything optional)", async () => {
      const agent = buildValidatorHarness(validateProfileUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects a firstName shorter than 2 characters", async () => {
      const agent = buildValidatorHarness(validateProfileUpdate);
      const res = await agent.post("/test").send({ firstName: "A" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.firstName);
    });

    it("rejects a lastName longer than 50 characters", async () => {
      const agent = buildValidatorHarness(validateProfileUpdate);
      const res = await agent.post("/test").send({ lastName: "a".repeat(51) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.lastName);
    });

    it("rejects a phone longer than 30 characters", async () => {
      const agent = buildValidatorHarness(validateProfileUpdate);
      const res = await agent.post("/test").send({ phone: "0".repeat(31) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.phone);
    });

    it("accepts valid profile fields", async () => {
      const agent = buildValidatorHarness(validateProfileUpdate);
      const res = await agent.post("/test").send({ firstName: "Marko", lastName: "Markovic", phone: "0601234567" });
      assert.equal(res.status, 200);
    });
  });
});