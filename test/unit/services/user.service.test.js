import { describe, it } from "node:test";
import assert from "node:assert/strict";
import userRepo from "../../../src/repositories/user.repository.js";
import orderRepo from "../../../src/repositories/order.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import partnerRepo from "../../../src/repositories/partner.repository.js";
import roleService from "../../../src/services/role.service.js";
import * as userService from "../../../src/services/user.service.js";
import { buildUser, buildRole, id } from "../../helpers/factories.js";

describe("user.service", () => {
  describe("registerUser", () => {
    it("rejects mismatched passwords before touching the database", async () => {
      await assert.rejects(
        () => userService.registerUser({ email: "a@b.com", password: "12345678", passwordConfirm: "different", firstName: "A", lastName: "B" }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a duplicate email with 409", async (t) => {
      t.mock.method(userRepo, "findUserByEmail", async () => buildUser());
      await assert.rejects(
        () =>
          userService.registerUser({
            email: "postoji@example.com",
            password: "12345678",
            passwordConfirm: "12345678",
            firstName: "A",
            lastName: "B",
          }),
        (err) => err.statusCode === 409
      );
    });

    it("makes the first-ever user an admin, auto-active and auto-confirmed", async (t) => {
      t.mock.method(userRepo, "findUserByEmail", async () => null);
      t.mock.method(userRepo, "countUsers", async () => 0); // no users exist yet
      const adminRole = buildRole({ name: "admin" });
      t.mock.method(roleService, "findRoleByName", async (name) => (name === "admin" ? adminRole : null));

      let createPayload;
      t.mock.method(userRepo, "createUser", async (payload) => {
        createPayload = payload;
        return buildUser({ ...payload, _id: id() });
      });

      const result = await userService.registerUser({
        email: "prvi@example.com",
        password: "12345678",
        passwordConfirm: "12345678",
        firstName: "Prvi",
        lastName: "Korisnik",
      });

      assert.equal(result.isFirstUser, true);
      assert.equal(result.confirmToken, null);
      assert.equal(createPayload.status, "active");
      assert.equal(createPayload.confirmed, true);
      assert.equal(createPayload.confirmToken, null);
      assert.deepEqual(createPayload.role, adminRole._id);
    });

    it("gives the second user the normal pending 'user' role flow", async (t) => {
      t.mock.method(userRepo, "findUserByEmail", async () => null);
      t.mock.method(userRepo, "countUsers", async () => 1); // an admin already exists
      const userRole = buildRole({ name: "user" });
      t.mock.method(roleService, "findRoleByName", async (name) => (name === "user" ? userRole : null));

      let createPayload;
      t.mock.method(userRepo, "createUser", async (payload) => {
        createPayload = payload;
        return buildUser({ ...payload, _id: id() });
      });

      const result = await userService.registerUser({
        email: "drugi@example.com",
        password: "12345678",
        passwordConfirm: "12345678",
        firstName: "Drugi",
        lastName: "Korisnik",
      });

      assert.equal(result.isFirstUser, false);
      assert.ok(result.confirmToken, "a real confirm token should be issued");
      assert.equal(createPayload.status, "pending");
      assert.equal(createPayload.confirmed, false);
      assert.deepEqual(createPayload.role, userRole._id);
    });

    it("throws if the admin role isn't seeded yet when the first user registers", async (t) => {
      t.mock.method(userRepo, "findUserByEmail", async () => null);
      t.mock.method(userRepo, "countUsers", async () => 0);
      t.mock.method(roleService, "findRoleByName", async () => null); // roles not seeded

      await assert.rejects(
        () =>
          userService.registerUser({
            email: "prvi@example.com",
            password: "12345678",
            passwordConfirm: "12345678",
            firstName: "Prvi",
            lastName: "Korisnik",
          }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("findOrCreateGoogleUser", () => {
    it("returns the existing user when the googleId already matches", async (t) => {
      const existing = buildUser({ googleId: "g-123" });
      t.mock.method(userRepo, "findUserByGoogleId", async () => existing);

      const result = await userService.findOrCreateGoogleUser({ googleId: "g-123", email: existing.email });

      assert.equal(result, existing);
    });

    it("links the googleId to an existing local account with the same email instead of duplicating", async (t) => {
      const existing = buildUser({ provider: "local", googleId: null });
      t.mock.method(userRepo, "findUserByGoogleId", async () => null);
      t.mock.method(userRepo, "findUserByEmail", async () => existing);
      t.mock.method(userRepo, "updateUserById", async (id_, patch) => ({ ...existing, ...patch }));

      const result = await userService.findOrCreateGoogleUser({ googleId: "g-999", email: existing.email });

      assert.equal(result.googleId, "g-999");
    });

    it("promotes the first-ever Google sign-up to admin too", async (t) => {
      t.mock.method(userRepo, "findUserByGoogleId", async () => null);
      t.mock.method(userRepo, "findUserByEmail", async () => null);
      t.mock.method(userRepo, "countUsers", async () => 0);
      const adminRole = buildRole({ name: "admin" });
      t.mock.method(roleService, "findRoleByName", async () => adminRole);

      let createPayload;
      t.mock.method(userRepo, "createUser", async (payload) => {
        createPayload = payload;
        return buildUser({ ...payload, _id: id() });
      });

      await userService.findOrCreateGoogleUser({ googleId: "g-1", email: "prvi@example.com", firstName: "Prvi" });

      assert.deepEqual(createPayload.role, adminRole._id);
    });
  });

  describe("createGuestUser", () => {
    it("always uses the plain 'user' role, never admin - even if it would technically be the first user", async (t) => {
      const userRole = buildRole({ name: "user" });
      t.mock.method(roleService, "findRoleByName", async (name) => (name === "user" ? userRole : null));

      let createPayload;
      t.mock.method(userRepo, "createUser", async (payload) => {
        createPayload = payload;
        return buildUser({ ...payload, _id: id() });
      });

      await userService.createGuestUser({ firstName: "Gost", email: "gost@example.com" });

      assert.equal(createPayload.status, "guest");
      assert.deepEqual(createPayload.role, userRole._id);
      assert.ok(createPayload.resetToken, "a claim-account token should be generated");
    });
  });

  describe("resetPassword", () => {
    it("rejects an invalid/expired token", async (t) => {
      t.mock.method(userRepo, "findUserByResetToken", async () => null);
      await assert.rejects(() => userService.resetPassword("bad-token", "newpassword1"), (err) => err.statusCode === 400);
    });

    it("claiming a guest account also flips status to active and confirmed", async (t) => {
      const guest = buildUser({ status: "guest", confirmed: false });
      t.mock.method(userRepo, "findUserByResetToken", async () => guest);
      let updatePayload;
      t.mock.method(userRepo, "updateUserById", async (id_, patch) => {
        updatePayload = patch;
        return { ...guest, ...patch };
      });

      await userService.resetPassword("valid-token", "newpassword1");

      assert.equal(updatePayload.status, "active");
      assert.equal(updatePayload.confirmed, true);
    });
  });

  describe("changePassword", () => {
    it("rejects when the current password is wrong", async (t) => {
      const user = buildUser();
      t.mock.method(userRepo, "findUserByIdWithPassword", async () => user);

      await assert.rejects(
        () => userService.changePassword(user._id.toString(), "wrong-current-password", "newpassword1"),
        (err) => err.statusCode === 401
      );
    });

    it("rejects changing password on a Google-only account with no password set", async (t) => {
      const user = buildUser({ password: null, provider: "google" });
      t.mock.method(userRepo, "findUserByIdWithPassword", async () => user);

      await assert.rejects(
        () => userService.changePassword(user._id.toString(), "anything", "newpassword1"),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("deactivateAccount", () => {
    it("requires a password when the account has one", async (t) => {
      const user = buildUser();
      t.mock.method(userRepo, "findUserByIdWithPassword", async () => user);
      await assert.rejects(() => userService.deactivateAccount(user._id.toString(), undefined), (err) => err.statusCode === 400);
    });
  });

  describe("updateUserStatus / updateUserRole / deleteUser", () => {
    it("updateUserStatus throws 404 for a nonexistent user", async (t) => {
      t.mock.method(userRepo, "updateUserById", async () => null);
      await assert.rejects(() => userService.updateUserStatus("missing", "inactive"), (err) => err.statusCode === 404);
    });

    it("updateUserRole requires both userId and roleId", async () => {
      await assert.rejects(() => userService.updateUserRole(null, "role-id"), (err) => err.statusCode === 400);
      await assert.rejects(() => userService.updateUserRole("user-id", null), (err) => err.statusCode === 400);
    });

    it("deleteUser throws 404 if the user doesn't exist", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => null);
      await assert.rejects(() => userService.deleteUser("missing"), (err) => err.statusCode === 404);
    });

    function mockNoUserReferences(t) {
      t.mock.method(orderRepo, "countOrders", async () => 0);
      t.mock.method(appointmentRepo, "countAppointments", async () => 0);
      t.mock.method(packagePurchaseRepo, "countPackagePurchases", async () => 0);
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => null);
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => null);
    }

    it("deletes a user with no historical footprint at all", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      t.mock.method(userRepo, "deleteUserById", async () => true);
      mockNoUserReferences(t);

      const result = await userService.deleteUser(id().toString());
      assert.equal(result.success, true);
    });

    it("refuses to hard-delete a user with orders", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      mockNoUserReferences(t);
      t.mock.method(orderRepo, "countOrders", async () => 1);
      await assert.rejects(() => userService.deleteUser(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to hard-delete a user with appointments", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      mockNoUserReferences(t);
      t.mock.method(appointmentRepo, "countAppointments", async () => 1);
      await assert.rejects(() => userService.deleteUser(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to hard-delete a user with package purchases", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      mockNoUserReferences(t);
      t.mock.method(packagePurchaseRepo, "countPackagePurchases", async () => 1);
      await assert.rejects(() => userService.deleteUser(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to hard-delete a user linked to an employee profile", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      mockNoUserReferences(t);
      t.mock.method(employeeRepo, "findEmployeeByUserId", async () => ({ _id: id() }));
      await assert.rejects(() => userService.deleteUser(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to hard-delete a user linked to a partner profile", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      mockNoUserReferences(t);
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => ({ _id: id() }));
      await assert.rejects(() => userService.deleteUser(id().toString()), (err) => err.statusCode === 400);
    });
  });

  describe("anonymizeUser", () => {
    it("throws 404 if the user doesn't exist", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => null);
      await assert.rejects(() => userService.anonymizeUser("missing"), (err) => err.statusCode === 404);
    });

    it("scrubs PII and sets status to deleted, keeping the document itself", async (t) => {
      t.mock.method(userRepo, "findUserById", async () => buildUser());
      let update;
      t.mock.method(userRepo, "updateUserById", async (userId, patch) => {
        update = patch;
        return buildUser();
      });

      const userId = id().toString();
      const result = await userService.anonymizeUser(userId);

      assert.equal(result.success, true);
      assert.equal(update.$set.status, "deleted");
      assert.equal(update.$set.firstName, "Obrisan");
      assert.equal(update.$set.email, `obrisan-${userId}@obrisan.local`);
      assert.equal(update.$set.password, null);
      assert.deepEqual(update.$set.addresses, []);
      // googleId must be $unset, not set to null - it's a sparse+unique index, and
      // an explicit null still counts as "has the field", which would collide
      // across multiple anonymized accounts
      assert.deepEqual(update.$unset, { googleId: 1 });
      assert.ok(!("googleId" in update.$set));
    });
  });
});