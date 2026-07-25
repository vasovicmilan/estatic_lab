import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import userRepo from "../../../src/repositories/user.repository.js";
import Role from "../../../src/models/role.model.js";

async function createTestRole(overrides = {}) {
    return Role.create({ name: "user", permissions: [], isDefault: true, priority: 0, ...overrides });
}

function validUserData(overrides = {}) {
    return {
        email: "korisnik@example.com",
        password: "lozinka123",
        firstName: "Marko",
        lastName: "Markovic",
        ...overrides,
    };
}

describe("user.repository", () => {
    before(async () => {
        await dbHandler.connect();
    });

    after(async () => {
        await dbHandler.closeDatabase();
    });

    afterEach(async () => {
        await dbHandler.clearDatabase();
    });

    describe("createUser", () => {
        it("rejects a firstName shorter than the schema minimum", async () => {
            const role = await createTestRole();
            await assert.rejects(
                () => userRepo.createUser(validUserData({ role: role._id, firstName: "X" })),
                (err) => err.name === "ValidationError"
            );
        });

        it("persists a user with the given role", async () => {
            const role = await createTestRole();
            const user = await userRepo.createUser(validUserData({ role: role._id }));

            assert.ok(user._id);
            assert.equal(user.email, "korisnik@example.com");
            assert.equal(String(user.role), String(role._id));
        });

        it("rejects a duplicate email at the schema level", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ role: role._id }));

            await assert.rejects(() => userRepo.createUser(validUserData({ role: role._id })));
        });
    });

    describe("findUserById", () => {
        it("returns null for a nonexistent id", async () => {
            const result = await userRepo.findUserById(new mongoose.Types.ObjectId());
            assert.equal(result, null);
        });

        it("returns a lean plain object, not a full document", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserById(created._id);

            assert.equal(found.email, "korisnik@example.com");
            assert.equal(typeof found.save, "undefined", "lean() results shouldn't have Mongoose document methods");
        });

        it("does not return the password field by default", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserById(created._id);

            assert.equal(found.password, undefined);
        });

        it("populates the role when requested", async () => {
            const role = await createTestRole({ name: "admin" });
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserById(created._id, { populateFields: [{ path: "role", select: "name" }] });

            assert.equal(found.role.name, "admin");
        });
    });

    describe("findUserByEmail / findUserByEmailWithPassword", () => {
        it("finds a user by email case-insensitively", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ email: "test@example.com", role: role._id }));

            const found = await userRepo.findUserByEmail("TEST@EXAMPLE.COM");

            assert.ok(found);
            assert.equal(found.email, "test@example.com");
        });

        it("returns null for an email that doesn't exist", async () => {
            const found = await userRepo.findUserByEmail("nope@example.com");
            assert.equal(found, null);
        });

        it("findUserByEmail hides the password field", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserByEmail("korisnik@example.com");

            assert.equal(found.password, undefined);
        });

        it("findUserByEmailWithPassword exposes the password field", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserByEmailWithPassword("korisnik@example.com");

            assert.ok(found.password);
        });
    });

    describe("findUserByGoogleId", () => {
        it("finds a user by their googleId", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ email: "g@example.com", googleId: "g-123", provider: "google", role: role._id }));

            const found = await userRepo.findUserByGoogleId("g-123");

            assert.ok(found);
            assert.equal(found.googleId, "g-123");
        });

        it("returns null when no user has that googleId", async () => {
            const found = await userRepo.findUserByGoogleId("nonexistent");
            assert.equal(found, null);
        });
    });

    describe("findUserByResetToken", () => {
        it("finds a user with a still-valid reset token", async () => {
            const role = await createTestRole();
            const future = new Date(Date.now() + 60 * 60 * 1000);
            await userRepo.createUser(
                validUserData({ email: "reset@example.com", role: role._id, resetToken: "abc123", resetTokenExpiration: future })
            );

            const found = await userRepo.findUserByResetToken("abc123");

            assert.ok(found);
            assert.equal(found.resetToken, "abc123");
        });

        it("does not return a user whose reset token has expired", async () => {
            const role = await createTestRole();
            const past = new Date(Date.now() - 60 * 60 * 1000);
            await userRepo.createUser(
                validUserData({ email: "expired@example.com", role: role._id, resetToken: "expired-token", resetTokenExpiration: past })
            );

            const found = await userRepo.findUserByResetToken("expired-token");

            assert.equal(found, null);
        });
    });

    describe("findUsers", () => {
        it("paginates results and returns pagination metadata", async () => {
            const role = await createTestRole();
            for (let i = 0; i < 15; i++) {
                await userRepo.createUser(validUserData({ email: `user${i}@example.com`, role: role._id }));
            }

            const result = await userRepo.findUsers({ limit: 10, page: 1 });

            assert.equal(result.data.length, 10);
            assert.equal(result.total, 15);
            assert.equal(result.totalPages, 2);
        });

        it("filters by search across firstName, lastName, and email", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ email: "jovana@example.com", firstName: "Jovana", lastName: "Jovanovic", role: role._id }));
            await userRepo.createUser(validUserData({ email: "marko@example.com", firstName: "Marko", lastName: "Markovic", role: role._id }));

            const result = await userRepo.findUsers({ search: "Jovana" });

            assert.equal(result.data.length, 1);
            assert.equal(result.data[0].email, "jovana@example.com");
        });

        it("filters by status", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ email: "active@example.com", role: role._id, status: "active" }));
            await userRepo.createUser(validUserData({ email: "pending@example.com", role: role._id, status: "pending" }));

            const result = await userRepo.findUsers({ filters: { status: "active" } });

            assert.equal(result.data.length, 1);
            assert.equal(result.data[0].email, "active@example.com");
        });
    });

    describe("updateUserById", () => {
        it("updates and returns the post-update document", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const updated = await userRepo.updateUserById(created._id, { firstName: "Izmenjeno" });

            assert.equal(updated.firstName, "Izmenjeno");
        });

        it("returns null when updating a nonexistent user", async () => {
            const updated = await userRepo.updateUserById(new mongoose.Types.ObjectId(), { firstName: "Nepostojeci" });
            assert.equal(updated, null);
        });
    });

    describe("updateLastLogin", () => {
        it("sets lastLogin to a recent timestamp", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const beforeTime = Date.now();
            const updated = await userRepo.updateLastLogin(created._id);

            assert.ok(new Date(updated.lastLogin).getTime() >= beforeTime);
        });
    });

    describe("deleteUserById", () => {
        it("deletes the user so it can no longer be found", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            await userRepo.deleteUserById(created._id);
            const found = await userRepo.findUserById(created._id);

            assert.equal(found, null);
        });
    });

    describe("countUsers", () => {
        it("counts users matching a filter", async () => {
            const role = await createTestRole();
            await userRepo.createUser(validUserData({ email: "a@example.com", role: role._id, status: "active" }));
            await userRepo.createUser(validUserData({ email: "b@example.com", role: role._id, status: "pending" }));

            const activeCount = await userRepo.countUsers({ status: "active" });

            assert.equal(activeCount, 1);
        });
    });

    describe("findUserByIdWithPassword", () => {
        it("exposes the normally-hidden password field", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const found = await userRepo.findUserByIdWithPassword(created._id);

            assert.ok(found.password, "password must be selected back in explicitly here");
        });

        it("returns null for a nonexistent id", async () => {
            const found = await userRepo.findUserByIdWithPassword(new mongoose.Types.ObjectId());
            assert.equal(found, null);
        });
    });

    describe("findUserByConfirmToken", () => {
        it("finds a user with a still-valid confirm token", async () => {
            const role = await createTestRole();
            const future = new Date(Date.now() + 60 * 60 * 1000);
            await userRepo.createUser(validUserData({ role: role._id, confirmToken: "confirm-abc", confirmTokenExpiration: future }));

            const found = await userRepo.findUserByConfirmToken("confirm-abc");

            assert.equal(found.confirmToken, "confirm-abc");
        });

        it("does not return a user whose confirm token has expired", async () => {
            const role = await createTestRole();
            const past = new Date(Date.now() - 60 * 60 * 1000);
            await userRepo.createUser(validUserData({ role: role._id, confirmToken: "confirm-abc", confirmTokenExpiration: past }));

            const found = await userRepo.findUserByConfirmToken("confirm-abc");

            assert.equal(found, null);
        });
    });

    describe("cart operations", () => {
        it("incrementCartItemQuantity increments an existing matching line, returns null when no line matches", async () => {
            const role = await createTestRole();
            const productId = new mongoose.Types.ObjectId();
            const variantId = new mongoose.Types.ObjectId();
            const created = await userRepo.createUser(
                validUserData({ role: role._id, cart: [{ product: productId, variant: variantId, quantity: 2 }] })
            );

            const updated = await userRepo.incrementCartItemQuantity(created._id, productId, variantId, 3);
            assert.equal(updated.cart[0].quantity, 5);

            const noMatch = await userRepo.incrementCartItemQuantity(created._id, new mongoose.Types.ObjectId(), variantId, 1);
            assert.equal(noMatch, null);
        });

        it("addCartItem appends a new line", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));
            const productId = new mongoose.Types.ObjectId();

            const updated = await userRepo.addCartItem(created._id, { product: productId, variant: null, quantity: 1 });

            assert.equal(updated.cart.length, 1);
            assert.equal(String(updated.cart[0].product), String(productId));
        });

        it("setCartItemQuantity sets an existing line's quantity by cart item id", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(
                validUserData({ role: role._id, cart: [{ product: new mongoose.Types.ObjectId(), quantity: 1 }] })
            );
            const cartItemId = created.cart[0]._id;

            const updated = await userRepo.setCartItemQuantity(created._id, cartItemId, 9);

            assert.equal(updated.cart[0].quantity, 9);
        });

        it("removeCartItem removes only the matching line", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(
                validUserData({
                    role: role._id,
                    cart: [
                        { product: new mongoose.Types.ObjectId(), quantity: 1 },
                        { product: new mongoose.Types.ObjectId(), quantity: 2 },
                    ],
                })
            );
            const removeId = created.cart[0]._id;

            const updated = await userRepo.removeCartItem(created._id, removeId);

            assert.equal(updated.cart.length, 1);
            assert.notEqual(String(updated.cart[0]._id), String(removeId));
        });

        it("clearCart empties the whole array", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(
                validUserData({ role: role._id, cart: [{ product: new mongoose.Types.ObjectId(), quantity: 1 }] })
            );

            const updated = await userRepo.clearCart(created._id);

            assert.equal(updated.cart.length, 0);
        });

        it("replaceCart overwrites the array wholesale with whatever was computed elsewhere", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(
                validUserData({ role: role._id, cart: [{ product: new mongoose.Types.ObjectId(), quantity: 1 }] })
            );
            const newCart = [{ product: new mongoose.Types.ObjectId(), quantity: 5 }];

            const updated = await userRepo.replaceCart(created._id, newCart);

            assert.equal(updated.cart.length, 1);
            assert.equal(updated.cart[0].quantity, 5);
        });

        it("findUserCartQuantities projects only the cart field", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(
                validUserData({ role: role._id, cart: [{ product: new mongoose.Types.ObjectId(), quantity: 3 }] })
            );

            const found = await userRepo.findUserCartQuantities(created._id);

            assert.equal(found.cart.length, 1);
            assert.equal(found.email, undefined, "only cart should be projected, not the rest of the document");
        });

        it("findUserCartQuantities returns null for a nonexistent user", async () => {
            const found = await userRepo.findUserCartQuantities(new mongoose.Types.ObjectId());
            assert.equal(found, null);
        });
    });

    describe("address operations", () => {
        function validAddress(overrides = {}) {
            return { city: "Novi Sad", postalCode: "21000", street: "encryptedstreet", number: "encryptednum", hash: `hash-${new mongoose.Types.ObjectId()}`, ...overrides };
        }

        it("addAddressToUser appends an address", async () => {
            const role = await createTestRole();
            const created = await userRepo.createUser(validUserData({ role: role._id }));

            const updated = await userRepo.addAddressToUser(created._id, validAddress());

            assert.equal(updated.addresses.length, 1);
        });

        it("removeAddressFromUser removes only the matching address", async () => {
            const role = await createTestRole();
            let user = await userRepo.createUser(validUserData({ role: role._id }));
            user = await userRepo.addAddressToUser(user._id, validAddress());
            user = await userRepo.addAddressToUser(user._id, validAddress());
            const removeId = user.addresses[0]._id;

            const updated = await userRepo.removeAddressFromUser(user._id, removeId);

            assert.equal(updated.addresses.length, 1);
            assert.notEqual(String(updated.addresses[0]._id), String(removeId));
        });

        it("setDefaultAddress unsets every other address before setting the new default", async () => {
            const role = await createTestRole();
            let user = await userRepo.createUser(validUserData({ role: role._id }));
            user = await userRepo.addAddressToUser(user._id, validAddress({ isDefault: true }));
            user = await userRepo.addAddressToUser(user._id, validAddress());
            const secondAddressId = user.addresses[1]._id;

            const updated = await userRepo.setDefaultAddress(user._id, secondAddressId);

            assert.equal(updated.addresses[0].isDefault, false, "the previously-default address must be unset");
            assert.equal(updated.addresses[1].isDefault, true);
        });
    });
});