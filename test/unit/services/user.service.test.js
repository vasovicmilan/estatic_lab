import { describe, it } from "node:test";
import assert from "node:assert/strict";
import userRepo from "../../../src/repositories/user.repository.js";
import orderRepo from "../../../src/repositories/order.repository.js";
import appointmentRepo from "../../../src/repositories/appointment.repository.js";
import packagePurchaseRepo from "../../../src/repositories/package-purchase.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import partnerRepo from "../../../src/repositories/partner.repository.js";
import roleService from "../../../src/services/role.service.js";
import productService from "../../../src/services/product.service.js";
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

  describe("cart", () => {
    describe("getCartItemCount - the nav badge, never throws", () => {
      it("sums quantities across all cart lines", async (t) => {
        t.mock.method(userRepo, "findUserCartQuantities", async () => ({ cart: [{ quantity: 2 }, { quantity: 3 }] }));
        assert.equal(await userService.getCartItemCount(id().toString()), 5);
      });

      it("returns 0 (not throw) for a nonexistent user", async (t) => {
        t.mock.method(userRepo, "findUserCartQuantities", async () => null);
        assert.equal(await userService.getCartItemCount(id().toString()), 0);
      });

      it("returns 0 (not throw) when no userId is given at all", async () => {
        assert.equal(await userService.getCartItemCount(null), 0);
      });
    });

    describe("addToCart", () => {
      it("throws if the variant doesn't exist or isn't active (via getVariationRaw)", async (t) => {
        t.mock.method(productService, "getVariationRaw", async () => {
          const err = new Error("Varijanta ne postoji");
          err.statusCode = 404;
          throw err;
        });

        await assert.rejects(
          () => userService.addToCart(id().toString(), { productId: id().toString(), variantId: id().toString() }),
          (err) => err.statusCode === 404
        );
      });

      it("rejects a zero or negative quantity", async () => {
        await assert.rejects(
          () => userService.addToCart(id().toString(), { productId: id().toString(), variantId: id().toString(), quantity: 0 }),
          (err) => err.statusCode === 400
        );
      });

      it("increments an existing matching line instead of adding a duplicate", async (t) => {
        t.mock.method(productService, "getVariationRaw", async () => ({}));
        let incrementCalled = false;
        t.mock.method(userRepo, "incrementCartItemQuantity", async () => {
          incrementCalled = true;
          return { cart: [] };
        });
        let addCalled = false;
        t.mock.method(userRepo, "addCartItem", async () => {
          addCalled = true;
        });
        t.mock.method(userRepo, "findUserById", async () => buildUser({ cart: [] }));

        await userService.addToCart(id().toString(), { productId: id().toString(), variantId: id().toString(), quantity: 2 });

        assert.equal(incrementCalled, true);
        assert.equal(addCalled, false, "should not add a second line when incrementing the existing one succeeded");
      });

      it("adds a new line only when no existing line was incremented", async (t) => {
        t.mock.method(productService, "getVariationRaw", async () => ({}));
        t.mock.method(userRepo, "incrementCartItemQuantity", async () => null);
        let addCalled = false;
        t.mock.method(userRepo, "addCartItem", async () => {
          addCalled = true;
        });
        t.mock.method(userRepo, "findUserById", async () => buildUser({ cart: [] }));

        await userService.addToCart(id().toString(), { productId: id().toString(), variantId: id().toString() });

        assert.equal(addCalled, true);
      });
    });

    describe("updateCartItemQuantity", () => {
      it("removes the line entirely when quantity is 0 or negative", async (t) => {
        let removeCalled = false;
        t.mock.method(userRepo, "removeCartItem", async () => {
          removeCalled = true;
        });
        t.mock.method(userRepo, "findUserById", async () => buildUser({ cart: [] }));

        await userService.updateCartItemQuantity(id().toString(), id().toString(), 0);

        assert.equal(removeCalled, true);
      });

      it("throws 404 when the cart item doesn't exist", async (t) => {
        t.mock.method(userRepo, "setCartItemQuantity", async () => null);
        await assert.rejects(
          () => userService.updateCartItemQuantity(id().toString(), id().toString(), 3),
          (err) => err.statusCode === 404
        );
      });
    });

    describe("mergeGuestCart", () => {
      it("sums quantities for a matching (product, variant) pair instead of duplicating the line", async (t) => {
        const productId = id();
        const existingUser = buildUser({ cart: [{ product: productId, variant: null, quantity: 2 }] });
        t.mock.method(userRepo, "findUserById", async () => existingUser);
        let replacedWith;
        t.mock.method(userRepo, "replaceCart", async (userId, cart) => {
          replacedWith = cart;
        });

        await userService.mergeGuestCart(existingUser._id.toString(), [{ productId: productId.toString(), variantId: null, quantity: 3 }]);

        assert.equal(replacedWith.length, 1);
        assert.equal(replacedWith[0].quantity, 5);
      });

      it("appends a new line for a product/variant the user's cart doesn't already have", async (t) => {
        const existingUser = buildUser({ cart: [] });
        t.mock.method(userRepo, "findUserById", async () => existingUser);
        let replacedWith;
        t.mock.method(userRepo, "replaceCart", async (userId, cart) => {
          replacedWith = cart;
        });

        await userService.mergeGuestCart(existingUser._id.toString(), [{ productId: id().toString(), variantId: id().toString(), quantity: 1 }]);

        assert.equal(replacedWith.length, 1);
      });

      it("skips the merge entirely (no repo call) when the guest cart is empty", async (t) => {
        let replaceCalled = false;
        t.mock.method(userRepo, "replaceCart", async () => {
          replaceCalled = true;
        });
        t.mock.method(userRepo, "findUserById", async () => buildUser({ cart: [] }));

        await userService.mergeGuestCart(id().toString(), []);

        assert.equal(replaceCalled, false);
      });

      it("throws 404 when the target user doesn't exist", async (t) => {
        t.mock.method(userRepo, "findUserById", async () => null);
        await assert.rejects(
          () => userService.mergeGuestCart(id().toString(), [{ productId: id().toString(), quantity: 1 }]),
          (err) => err.statusCode === 404
        );
      });
    });
  });

  describe("addresses", () => {
    describe("addAddress", () => {
      it("rejects an incomplete address (buildAddressRecord returns null)", async () => {
        await assert.rejects(() => userService.addAddress(id().toString(), {}), (err) => err.statusCode === 400);
      });

      it("sets the just-added address as default when isDefault is requested", async (t) => {
        t.mock.method(userRepo, "addAddressToUser", async () => {});
        const addressInput = { city: "Novi Sad", postalCode: "21000", street: "Ulica", number: "1", isDefault: true };
        // the service matches on the address's real computed hash, so compute it the
        // same way (buildAddressRecord) rather than using an arbitrary mismatched value
        const { buildAddressRecord } = await import("../../../src/utils/address.util.js");
        const expectedHash = buildAddressRecord(addressInput).hash;
        t.mock.method(userRepo, "findUserById", async () => buildUser({ addresses: [{ _id: id(), hash: expectedHash }] }));
        let defaultSetFor;
        t.mock.method(userRepo, "setDefaultAddress", async (userId, addressId) => {
          defaultSetFor = addressId;
        });

        await userService.addAddress(id().toString(), addressInput);

        assert.ok(defaultSetFor);
      });
    });

    describe("setDefaultAddress", () => {
      it("throws 404 when the address doesn't exist on this user", async (t) => {
        t.mock.method(userRepo, "setDefaultAddress", async () => null);
        await assert.rejects(
          () => userService.setDefaultAddress(id().toString(), id().toString()),
          (err) => err.statusCode === 404
        );
      });
    });

    describe("getAddresses", () => {
      it("throws 404 for a nonexistent user", async (t) => {
        t.mock.method(userRepo, "findUserById", async () => null);
        await assert.rejects(() => userService.getAddresses(id().toString()), (err) => err.statusCode === 404);
      });
    });
  });
});