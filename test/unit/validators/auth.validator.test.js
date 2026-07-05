import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
} from "../../../src/middlewares/validators/auth.validator.js";

function validRegistration(overrides = {}) {
  return {
    email: "novi@example.com",
    password: "lozinka123",
    passwordConfirm: "lozinka123",
    firstName: "Marko",
    lastName: "Markovic",
    ...overrides,
  };
}

describe("auth.validator", () => {
  describe("validateRegister", () => {
    it("accepts a fully valid registration", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const res = await agent.post("/test").send(validRegistration());
      assert.equal(res.status, 200);
    });

    it("rejects an invalid email format", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const res = await agent.post("/test").send(validRegistration({ email: "not-an-email" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("rejects a password shorter than 8 characters", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const res = await agent.post("/test").send(validRegistration({ password: "short", passwordConfirm: "short" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.password);
    });

    it("rejects mismatched password confirmation", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const res = await agent.post("/test").send(validRegistration({ passwordConfirm: "different1" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.passwordConfirm);
    });

    it("rejects a missing firstName", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const { firstName, ...rest } = validRegistration();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.firstName);
    });

    it("rejects a phone longer than 30 characters when one is given", async () => {
      const agent = buildValidatorHarness(validateRegister);
      const res = await agent.post("/test").send(validRegistration({ phone: "0".repeat(31) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.phone);
    });
  });

  describe("validateLogin", () => {
    it("rejects a missing email", async () => {
      const agent = buildValidatorHarness(validateLogin);
      const res = await agent.post("/test").send({ password: "whatever" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("rejects a missing password", async () => {
      const agent = buildValidatorHarness(validateLogin);
      const res = await agent.post("/test").send({ email: "test@example.com" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.password);
    });

    it("accepts valid login credentials shape", async () => {
      const agent = buildValidatorHarness(validateLogin);
      const res = await agent.post("/test").send({ email: "test@example.com", password: "anything" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateRequestPasswordReset", () => {
    it("rejects an invalid email", async () => {
      const agent = buildValidatorHarness(validateRequestPasswordReset);
      const res = await agent.post("/test").send({ email: "not-an-email" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("accepts a valid email", async () => {
      const agent = buildValidatorHarness(validateRequestPasswordReset);
      const res = await agent.post("/test").send({ email: "test@example.com" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateResetPassword", () => {
    it("rejects a missing newPassword", async () => {
      const agent = buildValidatorHarness(validateResetPassword, { path: "/test/:token" });
      const res = await agent.post("/test/sometoken").send({ confirmPassword: "lozinka123" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.newPassword);
    });

    it("rejects mismatched password confirmation", async () => {
      const agent = buildValidatorHarness(validateResetPassword, { path: "/test/:token" });
      const res = await agent.post("/test/sometoken").send({ newPassword: "lozinka123", confirmPassword: "different1" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.confirmPassword);
    });

    it("accepts a valid reset payload", async () => {
      const agent = buildValidatorHarness(validateResetPassword, { path: "/test/:token" });
      const res = await agent.post("/test/sometoken").send({ newPassword: "lozinka123", confirmPassword: "lozinka123" });
      assert.equal(res.status, 200);
    });
  });
});