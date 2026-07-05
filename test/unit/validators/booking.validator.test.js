import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateBookingConfirm } from "../../../src/middlewares/validators/booking.validator.js";

function validBooking(overrides = {}) {
  return {
    serviceId: new Types.ObjectId().toString(),
    servicePackageId: new Types.ObjectId().toString(),
    startTime: new Date().toISOString(),
    firstName: "Marko",
    email: "marko@example.com",
    phone: "0601234567",
    ...overrides,
  };
}

describe("booking.validator", () => {
  describe("validateBookingConfirm", () => {
    it("accepts a fully valid booking", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking());
      assert.equal(res.status, 200);
    });

    it("rejects a missing serviceId", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const { serviceId, ...rest } = validBooking();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.serviceId);
    });

    it("rejects a non-mongo-id servicePackageId", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ servicePackageId: "not-an-id" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.servicePackageId);
    });

    it("rejects a malformed startTime", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ startTime: "not-a-date" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.startTime);
    });

    it("rejects a missing firstName", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const { firstName, ...rest } = validBooking();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.firstName);
    });

    it("rejects an invalid email format", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ email: "not-an-email" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("rejects a missing phone", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const { phone, ...rest } = validBooking();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.phone);
    });

    it("rejects a phone shorter than 6 characters", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ phone: "123" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.phone);
    });

    it("accepts a booking without an optional employeeId", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking());
      assert.equal(res.status, 200);
    });

    it("rejects a non-mongo-id employeeId when one is given", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ employeeId: "not-an-id" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.employeeId);
    });

    it("rejects a note longer than 500 characters", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ note: "a".repeat(501) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.note);
    });

    it("rejects a couponCode longer than 50 characters", async () => {
      const agent = buildValidatorHarness(validateBookingConfirm);
      const res = await agent.post("/test").send(validBooking({ couponCode: "a".repeat(51) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.couponCode);
    });
  });
});