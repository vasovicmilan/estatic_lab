import { describe, it } from "node:test";
import assert from "node:assert/strict";
import roleRepo from "../../../../src/repositories/role.repository.js";
import * as roleService from "../../../../src/services/role.service.js";
import { buildRole } from "../../helpers/factories.js";
import { buildPaginatedResult } from "../../helpers/pagination.js";

describe("role.service", () => {
  describe("listRoles", () => {
    it("maps repository results into the admin list shape", async (t) => {
      const role = buildRole({ name: "admin", priority: 100 });
      t.mock.method(roleRepo, "findRoles", async () => buildPaginatedResult([role]));

      const result = await roleService.listRoles({ search: "" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].naziv, "admin");
      assert.equal(result.total, 1);
    });
  });

  describe("getRoleById", () => {
    it("throws 404 when the role doesn't exist", async (t) => {
      t.mock.method(roleRepo, "findRoleById", async () => null);
      await assert.rejects(() => roleService.getRoleById("missing"), (err) => err.statusCode === 404);
    });

    it("throws 400 when no id is given", async () => {
      await assert.rejects(() => roleService.getRoleById(), (err) => err.statusCode === 400);
    });

    it("maps a found role into the admin detail shape", async (t) => {
      const role = buildRole({ permissions: ["view_dashboard"] });
      t.mock.method(roleRepo, "findRoleById", async () => role);

      const result = await roleService.getRoleById(role._id.toString());

      assert.equal(result.osnovno.naziv, role.name);
      assert.equal(result.permisije.length, 1);
    });
  });

  describe("createRole", () => {
    it("rejects a duplicate role name with 409", async (t) => {
      t.mock.method(roleRepo, "findRoleByName", async () => buildRole({ name: "user" }));
      await assert.rejects(() => roleService.createRole({ name: "user" }), (err) => err.statusCode === 409);
    });

    it("creates a role when the name is free", async (t) => {
      t.mock.method(roleRepo, "findRoleByName", async () => null);
      const created = buildRole({ name: "employee" });
      t.mock.method(roleRepo, "createRole", async () => created);
      t.mock.method(roleRepo, "findRoleById", async () => created);

      const result = await roleService.createRole({ name: "employee" });

      assert.equal(result.osnovno.naziv, "employee");
    });
  });

  describe("updateRoleById", () => {
    it("throws 404 when the role to update doesn't exist", async (t) => {
      t.mock.method(roleRepo, "findRoleById", async () => null);
      await assert.rejects(() => roleService.updateRoleById("missing", {}), (err) => err.statusCode === 404);
    });

    it("rejects renaming to an already-taken name", async (t) => {
      const existing = buildRole({ name: "employee" });
      t.mock.method(roleRepo, "findRoleById", async () => existing);
      t.mock.method(roleRepo, "findRoleByName", async () => buildRole({ name: "admin" }));

      await assert.rejects(
        () => roleService.updateRoleById(existing._id.toString(), { name: "admin" }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("deleteRoleById", () => {
    it("refuses to delete the default role", async (t) => {
      t.mock.method(roleRepo, "findRoleById", async () => buildRole({ isDefault: true }));
      await assert.rejects(() => roleService.deleteRoleById("x"), (err) => err.statusCode === 400);
    });

    it("deletes a non-default role", async (t) => {
      t.mock.method(roleRepo, "findRoleById", async () => buildRole({ isDefault: false }));
      t.mock.method(roleRepo, "deleteRoleById", async () => true);

      const result = await roleService.deleteRoleById("x");

      assert.equal(result.success, true);
    });
  });

  describe("findDefaultRole / findRoleByName", () => {
    it("returns null gracefully when no name is given to findRoleByName", async () => {
      const result = await roleService.findRoleByName();
      assert.equal(result, null);
    });
  });
});