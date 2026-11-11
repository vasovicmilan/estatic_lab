import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Role, { PERMISSIONS } from "../../../src/models/role.model.js";
import { managerRoles, seedRoles } from "../../../src/database/seeds/roles.seed.js";

describe("manager roles", () => {
  it("use only real permissions and a valid role name", () => {
    for (const r of managerRoles) {
      assert.match(r.name, /^[a-z][a-z0-9 _-]{1,49}$/);
      r.permissions.forEach((p) => assert.ok(PERMISSIONS.includes(p), `${r.name}: ${p}`));
      assert.ok(r.permissions.includes("access_admin_panel") && r.permissions.includes("view_dashboard"));
    }
  });

  it("keep coupons, orders, users, marketing, site content, logs and reports with the admin", () => {
    const forbidden = ["manage_coupons", "manage_orders", "manage_users", "manage_roles", "manage_marketing", "manage_site_content", "view_logs", "view_business_reports", "manage_employees", "manage_payouts", "manage_partners"];
    for (const r of managerRoles) forbidden.forEach((p) => assert.ok(!r.permissions.includes(p), `${r.name} must not have ${p}`));
  });

  it("scope each manager to its own area", () => {
    const by = Object.fromEntries(managerRoles.map((r) => [r.name, r.permissions]));
    assert.ok(by["menadzer bloga"].includes("manage_blog") && !by["menadzer bloga"].includes("manage_products"));
    assert.ok(by["menadzer usluga"].includes("manage_services") && by["menadzer usluga"].includes("manage_packages"));
    assert.ok(by["menadzer prodavnice"].includes("manage_products") && !by["menadzer prodavnice"].includes("manage_coupons"));
  });

  it("seeding creates the missing roles and updates the existing ones", async (t) => {
    const upserts = [];
    t.mock.method(Role, "find", () => ({ select: () => ({ lean: async () => [{ name: "admin" }, { name: "user" }, { name: "menadzer bloga" }] }) }));
    t.mock.method(Role, "findOneAndUpdate", async (q, d, o) => { upserts.push({ name: q.name, upsert: o.upsert, permissions: d.permissions }); return d; });
    const out = await seedRoles();
    assert.equal(out.length, 7);
    assert.ok(upserts.every((u) => u.upsert === true));
    assert.deepEqual(upserts.map((u) => u.name).sort(), ["admin", "employee", "menadzer bloga", "menadzer prodavnice", "menadzer usluga", "partner", "user"]);
    // the admin definition keeps everything the live admin role already has
    const admin = upserts.find((u) => u.name === "admin").permissions;
    ["manage_site_content", "view_business_reports", "manage_coupons", "manage_roles"].forEach((p) => assert.ok(admin.includes(p)));
  });
});
