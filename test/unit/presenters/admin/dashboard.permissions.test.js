import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareDashboardData } from "../../../../src/presenters/admin/dashboard.presenter.js";

const stats = { pendingAppointments: 3, unassignedAppointments: 1, newContacts: 2, pendingOrders: 4, pendingPayoutRequests: 1, pendingTestimonials: 0, outOfStockProducts: 2, todayAppointments: 5, confirmedAppointments: 10, activeEmployees: 6, totalUsers: 120, activePackagePurchases: 8, inactiveResources: 1, newsletterSubscribers: 45 };
const labels = (v) => v.sections.flatMap((s) => s.tiles.map((t) => t.label));

describe("dashboard - scoped roles", () => {
  it("a blog manager sees no business tiles and no activity feeds", () => {
    const v = prepareDashboardData(stats, {}, { permissions: ["access_admin_panel", "view_dashboard", "manage_blog", "manage_taxonomy"] });
    assert.deepEqual(labels(v), []);
    assert.equal(v.activityTabs.length, 0);
  });

  it("a shop manager sees only the out-of-stock tile", () => {
    const v = prepareDashboardData(stats, {}, { permissions: ["manage_products"] });
    assert.deepEqual(labels(v), ["Proizvodi bez zaliha"]);
  });

  it("a services manager gets no sales, user or contact data", () => {
    const v = prepareDashboardData(stats, {}, { permissions: ["manage_services", "manage_packages", "manage_taxonomy"] });
    const l = labels(v);
    assert.ok(!l.includes("Aktivni kupljeni paketi") && !l.includes("Registrovani korisnici") && !l.includes("Nove poruke"));
  });

  it("without a permissions list nothing is filtered (admin / older callers)", () => {
    assert.equal(labels(prepareDashboardData(stats, {})).length, 14);
  });

  it("every permission named on a tile is a real permission", async () => {
    const { PERMISSIONS } = await import("../../../../src/models/role.model.js");
    const v = prepareDashboardData(stats, {});
    [...v.sections.flatMap((s) => s.tiles), ...v.activityTabs].forEach((x) => {
      if (x.permission) assert.ok(PERMISSIONS.includes(x.permission), x.permission);
    });
  });
});
