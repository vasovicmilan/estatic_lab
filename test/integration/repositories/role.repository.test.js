import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import roleRepo from "../../../src/repositories/role.repository.js";

describe("role.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createRole", () => {
    it("persists a role", async () => {
      const role = await roleRepo.createRole({ name: "admin", permissions: ["manage_users"] });
      assert.ok(role._id);
      assert.equal(role.name, "admin");
    });

    it("accepts a custom role name outside the old closed set", async () => {
      const role = await roleRepo.createRole({ name: "superadmin" });
      assert.ok(role._id);
      assert.equal(role.name, "superadmin");
    });

    it("rejects a name with an invalid format at the schema level", async () => {
      await assert.rejects(() => roleRepo.createRole({ name: "Bad Name!" }));
    });

    it("rejects a duplicate role name (unique index)", async () => {
      await roleRepo.createRole({ name: "admin" });
      await assert.rejects(() => roleRepo.createRole({ name: "admin" }));
    });

    it("rejects a permission outside the closed enum", async () => {
      await assert.rejects(() => roleRepo.createRole({ name: "user", permissions: ["delete_everything"] }));
    });
  });

  describe("findRoleById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await roleRepo.findRoleById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findRoleByName", () => {
    it("finds a role by its exact name", async () => {
      await roleRepo.createRole({ name: "employee" });
      const found = await roleRepo.findRoleByName("employee");
      assert.ok(found);
      assert.equal(found.name, "employee");
    });

    it("returns null when no role has that name", async () => {
      const found = await roleRepo.findRoleByName("user");
      assert.equal(found, null);
    });
  });

  describe("findDefaultRole", () => {
    it("finds the role flagged as default", async () => {
      await roleRepo.createRole({ name: "admin", isDefault: false });
      await roleRepo.createRole({ name: "user", isDefault: true });

      const found = await roleRepo.findDefaultRole();

      assert.ok(found);
      assert.equal(found.name, "user");
    });

    it("returns null when no role is marked default", async () => {
      await roleRepo.createRole({ name: "admin", isDefault: false });
      const found = await roleRepo.findDefaultRole();
      assert.equal(found, null);
    });
  });

  describe("findRoles", () => {
    it("searches by name case-insensitively", async () => {
      await roleRepo.createRole({ name: "admin" });
      await roleRepo.createRole({ name: "employee" });

      const result = await roleRepo.findRoles({ search: "admin" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].name, "admin");
    });

    it("sorts by priority descending, then name", async () => {
      await roleRepo.createRole({ name: "user", priority: 0 });
      await roleRepo.createRole({ name: "admin", priority: 100 });
      await roleRepo.createRole({ name: "employee", priority: 50 });

      const result = await roleRepo.findRoles({});

      assert.deepEqual(result.data.map((r) => r.name), ["admin", "employee", "user"]);
    });

    it("paginates results", async () => {
      await roleRepo.createRole({ name: "admin" });
      await roleRepo.createRole({ name: "employee" });
      await roleRepo.createRole({ name: "user" });

      const result = await roleRepo.findRoles({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("updateRoleById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await roleRepo.createRole({ name: "user" });
      const updated = await roleRepo.updateRoleById(created._id, { description: "Novi opis" });
      assert.equal(updated.description, "Novi opis");
    });

    it("returns null when updating a nonexistent role", async () => {
      const updated = await roleRepo.updateRoleById(new mongoose.Types.ObjectId(), { description: "X" });
      assert.equal(updated, null);
    });
  });

  describe("deleteRoleById", () => {
    it("deletes the role", async () => {
      const created = await roleRepo.createRole({ name: "user" });
      await roleRepo.deleteRoleById(created._id);
      const found = await roleRepo.findRoleById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countRoles", () => {
    it("counts roles matching a search filter", async () => {
      await roleRepo.createRole({ name: "admin" });
      await roleRepo.createRole({ name: "employee" });

      const count = await roleRepo.countRoles({ search: "admin" });

      assert.equal(count, 1);
    });
  });
});