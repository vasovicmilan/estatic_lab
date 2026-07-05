import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateWorkingHoursUpdate,
  validateEmployeeId,
} from "../../../src/middlewares/validators/employee.validator.js";

describe("employee.validator", () => {
  describe("validateEmployeeCreate", () => {
    it("rejects a missing userId", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.userId);
    });

    it("rejects a non-mongo-id userId", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({ userId: "not-an-id" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.userId);
    });

    it("accepts a minimal valid payload", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({ userId: new Types.ObjectId().toString() });
      assert.equal(res.status, 200);
    });

    it("rejects an invalid day in workingHours", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({
        userId: new Types.ObjectId().toString(),
        workingHours: [{ day: "funday", slots: [] }],
      });
      assert.equal(res.status, 400);
    });

    it("rejects a malformed time string in a slot", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({
        userId: new Types.ObjectId().toString(),
        workingHours: [{ day: "monday", slots: [{ from: "9am", to: "17:00" }] }],
      });
      assert.equal(res.status, 400);
    });

    it("accepts well-formed workingHours", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({
        userId: new Types.ObjectId().toString(),
        workingHours: [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }],
      });
      assert.equal(res.status, 200);
    });

    it("rejects a non-mongo-id inside the services array", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({
        userId: new Types.ObjectId().toString(),
        services: ["not-an-id"],
      });
      assert.equal(res.status, 400);
    });

    it("rejects a notes field over 500 characters", async () => {
      const agent = buildValidatorHarness(validateEmployeeCreate);
      const res = await agent.post("/test").send({
        userId: new Types.ObjectId().toString(),
        notes: "a".repeat(501),
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.notes);
    });
  });

  describe("validateEmployeeUpdate", () => {
    it("accepts an empty body (everything optional on update)", async () => {
      const agent = buildValidatorHarness(validateEmployeeUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects an invalid isActive value", async () => {
      const agent = buildValidatorHarness(validateEmployeeUpdate);
      const res = await agent.post("/test").send({ isActive: "maybe" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateWorkingHoursUpdate", () => {
    it("rejects a badly formatted time", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const res = await agent.post("/test").send({
        workingHours: [{ day: "tuesday", slots: [{ from: "25:00", to: "26:00" }] }],
      });
      assert.equal(res.status, 400);
    });

    it("accepts a valid workingHours payload", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const res = await agent.post("/test").send({
        workingHours: [{ day: "tuesday", slots: [{ from: "10:00", to: "14:00" }] }],
      });
      assert.equal(res.status, 200);
    });
  });

  describe("validateEmployeeId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateEmployeeId, { method: "get", path: "/test/:employeeId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateEmployeeId, { method: "get", path: "/test/:employeeId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});