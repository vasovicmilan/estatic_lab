import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateAppointmentReject,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentId,
} from "../../../src/middlewares/validators/appointment.validator.js";

describe("appointment.validator", () => {
  describe("validateAppointmentReject", () => {
    it("accepts an empty body (reason is optional)", async () => {
      const agent = buildValidatorHarness(validateAppointmentReject);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects a reason longer than 500 characters", async () => {
      const agent = buildValidatorHarness(validateAppointmentReject);
      const res = await agent.post("/test").send({ reason: "a".repeat(501) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.reason);
    });

    it("accepts a reason within the limit", async () => {
      const agent = buildValidatorHarness(validateAppointmentReject);
      const res = await agent.post("/test").send({ reason: "Nema slobodnog termina" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateAppointmentCancel", () => {
    it("rejects a reason longer than 500 characters", async () => {
      const agent = buildValidatorHarness(validateAppointmentCancel);
      const res = await agent.post("/test").send({ reason: "a".repeat(501) });
      assert.equal(res.status, 400);
    });
  });

  describe("validateAppointmentReassign", () => {
    it("rejects a missing employeeId", async () => {
      const agent = buildValidatorHarness(validateAppointmentReassign);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.employeeId);
    });

    it("rejects a non-mongo-id employeeId", async () => {
      const agent = buildValidatorHarness(validateAppointmentReassign);
      const res = await agent.post("/test").send({ employeeId: "not-an-id" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.employeeId);
    });

    it("accepts a valid employeeId", async () => {
      const agent = buildValidatorHarness(validateAppointmentReassign);
      const res = await agent.post("/test").send({ employeeId: new Types.ObjectId().toString() });
      assert.equal(res.status, 200);
    });
  });

  describe("validateAppointmentId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateAppointmentId, { method: "get", path: "/test/:appointmentId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateAppointmentId, { method: "get", path: "/test/:appointmentId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});