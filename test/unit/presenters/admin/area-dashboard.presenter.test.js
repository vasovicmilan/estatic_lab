import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { availableAreas, prepareBlogDashboardData, prepareShopDashboardData, prepareCatalogDashboardData } from "../../../../src/presenters/admin/area-dashboard.presenter.js";
import { PERMISSIONS } from "../../../../src/models/role.model.js";

const labels = (v) => v.sections.flatMap((s) => s.tiles.map((t) => t.label));
const tabIds = (v) => v.activityTabs.map((t) => t.id);

describe("availableAreas", () => {
  it("blog manager only gets the blog overview", () => {
    assert.deepEqual(availableAreas(["manage_blog"]).map((a) => a.key), ["blog"]);
  });
  it("services OR packages permission opens the catalog overview", () => {
    assert.deepEqual(availableAreas(["manage_packages"]).map((a) => a.key), ["catalog"]);
    assert.deepEqual(availableAreas(["manage_services"]).map((a) => a.key), ["catalog"]);
  });
  it("no matching permission means no areas", () => {
    assert.deepEqual(availableAreas(["manage_coupons"]), []);
    assert.deepEqual(availableAreas(), []);
  });
  it("every permission an area names is real", () => {
    const real = new Set(Object.values(PERMISSIONS));
    for (const a of availableAreas(Array.from(real))) for (const p of a.anyOf) assert.ok(real.has(p), p);
  });
});

describe("blog dashboard", () => {
  const v = prepareBlogDashboardData({
    stats: { published: 5, scheduled: 1, draft: 2, archived: 0, totalViews: 99, missingSeo: 3 },
    scheduled: [{ id: "a", naslov: "A", zakazanoZa: "1.1.2027" }],
    drafts: [], top: [{ id: "b", naslov: "B", pregledi: 7 }], recent: [],
  });
  it("shows counts and attention tile", () => {
    assert.ok(labels(v).includes("Objavljeni bez meta opisa"));
    assert.equal(v.sections[0].tiles.find((t) => t.label === "Objavljeni").value, 5);
  });
  it("maps items to detail links", () => {
    assert.equal(v.activityTabs.find((t) => t.id === "top").items[0].url, "/admin/blog/detalji/b");
  });
});

describe("shop dashboard", () => {
  const base = { stats: { active: 4, inactive: 1, outOfStock: 2, pendingOrders: 3 }, inactive: [], outOfStock: [{ id: "p", naziv: "P", poNarudzbini: true }], recent: [], pendingOrders: [{ id: "o", korisnik: "K", ukupnaCena: "1 RSD", datum: "d" }] };
  it("hides orders without manage_orders", () => {
    const v = prepareShopDashboardData({ ...base, canOrders: false });
    assert.ok(!tabIds(v).includes("orders"));
    assert.ok(!labels(v).includes("Porudžbine na čekanju"));
  });
  it("shows orders with manage_orders", () => {
    const v = prepareShopDashboardData({ ...base, canOrders: true });
    assert.ok(tabIds(v).includes("orders"));
    assert.ok(labels(v).includes("Porudžbine na čekanju"));
  });
});

describe("catalog dashboard", () => {
  const base = { stats: { activeServices: 1, inactiveServices: 2, activePackages: 3, inactivePackages: 4, inactiveResources: 5 }, inactiveServices: [], recentServices: [], inactivePackages: [], recentPackages: [] };
  it("services-only role gets no package tiles/tabs", () => {
    const v = prepareCatalogDashboardData({ ...base, canServices: true, canPackages: false, canResources: false });
    assert.ok(!labels(v).some((l) => /paket/i.test(l)));
    assert.ok(tabIds(v).every((id) => id.includes("services")));
  });
  it("packages-only role gets no service tiles/tabs", () => {
    const v = prepareCatalogDashboardData({ ...base, canServices: false, canPackages: true, canResources: false });
    assert.ok(!labels(v).some((l) => /usluge/i.test(l)));
  });
  it("resources tile requires manage_resources", () => {
    const v = prepareCatalogDashboardData({ ...base, canServices: true, canPackages: true, canResources: true });
    assert.ok(labels(v).includes("Neaktivni resursi"));
  });
});
