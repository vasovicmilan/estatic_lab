import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { translatePermission, mapRolesForAdminList, mapRoleForAdminDetail, mapRoleForEdit, mapRolesForSelect } from "../../../src/mappers/role.mapper.js";
import { buildRole } from "../../helpers/factories.js";

describe("role.mapper", () => {
  describe("translatePermission", () => {
    it("translates every currently-defined permission, including the shop ones added later", () => {
      assert.equal(translatePermission("access_admin_panel"), "Pristup Admin Panelu");
      assert.equal(translatePermission("manage_products"), "Upravljanje proizvodima");
      assert.equal(translatePermission("manage_orders"), "Upravljanje porudžbinama");
    });

    it("falls back to the raw permission string for an unrecognized one, instead of showing 'undefined'", () => {
      assert.equal(translatePermission("some_future_permission"), "some_future_permission");
    });
  });

  describe("mapRoleForAdminDetail - permission list shape", () => {
    it("maps each permission code to a {kod, naziv} pair for display", () => {
      const role = buildRole({ permissions: ["manage_products", "view_dashboard"] });
      const mapped = mapRoleForAdminDetail(role);
      assert.deepEqual(mapped.permisije, [
        { kod: "manage_products", naziv: "Upravljanje proizvodima" },
        { kod: "view_dashboard", naziv: "Pregled dashboard-a" },
      ]);
    });

    it("handles a role with no permissions at all", () => {
      const role = buildRole({ permissions: [] });
      const mapped = mapRoleForAdminDetail(role);
      assert.deepEqual(mapped.permisije, []);
    });
  });

  describe("mapRolesForAdminList", () => {
    it("shows the permission count, not the full list, on the list view", () => {
      const role = buildRole({ permissions: ["a", "b", "c"] });
      const [mapped] = mapRolesForAdminList([role]);
      assert.equal(mapped.brojPermisija, 3);
    });

    it("translates isDefault to Da/Ne", () => {
      assert.equal(mapRolesForAdminList([buildRole({ isDefault: true })])[0].podrazumevana, "Da");
      assert.equal(mapRolesForAdminList([buildRole({ isDefault: false })])[0].podrazumevana, "Ne");
    });

    it("filters out null entries", () => {
      assert.equal(mapRolesForAdminList([buildRole(), null]).length, 1);
    });
  });

  describe("mapRoleForEdit - raw form shape", () => {
    it("keeps isDefault as a raw boolean and permissions as the raw code array (not translated)", () => {
      const role = buildRole({ isDefault: true, permissions: ["manage_products"] });
      const mapped = mapRoleForEdit(role);
      assert.equal(mapped.isDefault, true);
      assert.deepEqual(mapped.permissions, ["manage_products"]);
    });
  });

  describe("mapRolesForSelect", () => {
    it("returns a minimal {id, naziv} shape for dropdowns", () => {
      const role = buildRole({ name: "employee" });
      const [mapped] = mapRolesForSelect([role]);
      assert.equal(mapped.naziv, "employee");
      assert.ok(!("permissions" in mapped));
    });
  });

  describe("null safety", () => {
    it("returns null for a null role", () => {
      assert.equal(mapRoleForAdminDetail(null), null);
      assert.equal(mapRoleForEdit(null), null);
    });
  });
});