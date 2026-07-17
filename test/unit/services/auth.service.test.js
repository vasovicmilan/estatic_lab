import { describe, it } from "node:test";
import assert from "node:assert/strict";
import userService from "../../../src/services/user.service.js";
import eventEmitter from "../../../src/events/event.emitter.js";
import { hashPassword } from "../../../src/services/crypto.service.js";
import * as authService from "../../../src/services/auth.service.js";
import { buildUser, buildRole } from "../../helpers/factories.js";

describe("auth.service", () => {
  describe("register", () => {
    it("emits user:registered for a normal (non-first) signup", async (t) => {
      t.mock.method(userService, "registerUser", async () => ({ id: "1", email: "a@b.com", firstName: "A", isFirstUser: false, confirmToken: "tok" }));
      const emitMock = t.mock.method(eventEmitter, "emit");

      await authService.register({});

      const registeredCalls = emitMock.mock.calls.filter((c) => c.arguments[0] === "user:registered");
      assert.equal(registeredCalls.length, 1);
    });

    it("does NOT emit user:registered for the first (admin) user - no one to send a confirmation email to", async (t) => {
      t.mock.method(userService, "registerUser", async () => ({ id: "1", email: "admin@b.com", firstName: "Admin", isFirstUser: true, confirmToken: null }));
      const emitMock = t.mock.method(eventEmitter, "emit");

      await authService.register({});

      const registeredCalls = emitMock.mock.calls.filter((c) => c.arguments[0] === "user:registered");
      assert.equal(registeredCalls.length, 0);
    });
  });

  describe("login", () => {
    it("rejects when no account exists for the email", async (t) => {
      t.mock.method(userService, "findUserForLogin", async () => null);
      await assert.rejects(() => authService.login("nema@example.com", "lozinka1"), (err) => err.statusCode === 401);
    });

    it("rejects a Google-only account (no password set)", async (t) => {
      t.mock.method(userService, "findUserForLogin", async () => buildUser({ password: null, provider: "google" }));
      await assert.rejects(() => authService.login("g@example.com", "bilokoja"), (err) => err.statusCode === 401);
    });

    it("rejects a suspended account even with the correct password", async (t) => {
      const hash = await hashPassword("tacnalozinka");
      t.mock.method(userService, "findUserForLogin", async () => buildUser({ password: hash, status: "suspended" }));
      await assert.rejects(() => authService.login("s@example.com", "tacnalozinka"), (err) => err.statusCode === 401);
    });

    it("rejects a pending (unconfirmed) account", async (t) => {
      const hash = await hashPassword("tacnalozinka");
      t.mock.method(userService, "findUserForLogin", async () => buildUser({ password: hash, status: "pending" }));
      await assert.rejects(() => authService.login("p@example.com", "tacnalozinka"), (err) => err.statusCode === 401);
    });

    it("rejects a wrong password on an otherwise-valid account", async (t) => {
      const hash = await hashPassword("tacnalozinka");
      t.mock.method(userService, "findUserForLogin", async () => buildUser({ password: hash, status: "active" }));
      await assert.rejects(() => authService.login("a@example.com", "pogresnalozinka"), (err) => err.statusCode === 401);
    });

    it("logs in successfully, reactivates an inactive account, and returns a role name", async (t) => {
      const hash = await hashPassword("tacnalozinka");
      const role = buildRole({ name: "user" });
      const user = buildUser({ password: hash, status: "inactive", role });
      t.mock.method(userService, "findUserForLogin", async () => user);
      t.mock.method(userService, "updateLastLogin", async () => {});
      const statusUpdateMock = t.mock.method(userService, "updateUserStatus", async () => {});

      const result = await authService.login("a@example.com", "tacnalozinka");

      assert.equal(result.email, user.email);
      assert.equal(result.roleName, "user");
      assert.ok(result.token, "a JWT should be issued");
      assert.equal(statusUpdateMock.mock.calls.length, 1, "an inactive account should be reactivated on successful login");
    });
  });

  describe("requestPasswordReset / resendVerificationEmail", () => {
    it("returns the same message whether or not the email exists (no account enumeration)", async (t) => {
      t.mock.method(userService, "findUserByEmail", async () => null);
      const resultForMissing = await authService.requestPasswordReset("nepostojeci@example.com");

      t.mock.method(userService, "findUserByEmail", async () => buildUser());
      t.mock.method(userService, "setPasswordResetToken", async () => ({ token: "abc" }));
      const resultForExisting = await authService.requestPasswordReset("postojeci@example.com");

      assert.equal(resultForMissing.message, resultForExisting.message);
    });

    it("resendVerificationEmail refuses to resend for an already-confirmed account", async (t) => {
      t.mock.method(userService, "findUserByEmail", async () => buildUser({ confirmed: true }));
      await assert.rejects(() => authService.resendVerificationEmail("vec@example.com"), (err) => err.statusCode === 400);
    });
  });

  describe("resetPassword / changePassword", () => {
    it("resetPassword rejects mismatched new/confirm passwords", async () => {
      await assert.rejects(
        () => authService.resetPassword("token", "novalozinka1", "necega-drugo"),
        (err) => err.statusCode === 400
      );
    });

    it("changePassword rejects mismatched new/confirm passwords", async () => {
      await assert.rejects(
        () => authService.changePassword("userId", "staralozinka", "novalozinka1", "necega-drugo"),
        (err) => err.statusCode === 400
      );
    });
  });
});