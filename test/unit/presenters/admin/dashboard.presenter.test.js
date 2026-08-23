import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareDashboardData } from "../../../../src/presenters/admin/dashboard.presenter.js";

function buildStats(overrides = {}) {
  return {
    pendingAppointments: 3,
    unassignedAppointments: 1,
    newContacts: 2,
    pendingOrders: 4,
    pendingPayoutRequests: 1,
    pendingTestimonials: 0,
    outOfStockProducts: 2,
    todayAppointments: 5,
    confirmedAppointments: 10,
    activeEmployees: 6,
    totalUsers: 120,
    activePackagePurchases: 8,
    inactiveResources: 1,
    newsletterSubscribers: 45,
    ...overrides,
  };
}

describe("prepareDashboardData", () => {
  it("puts pending-appointments, unassigned-appointments, contacts, and orders into the 'Zahteva pažnju' section", () => {
    const view = prepareDashboardData(buildStats(), {});
    const attentionSection = view.sections.find((s) => s.title === "Zahteva pažnju");
    const labels = attentionSection.tiles.map((t) => t.label);

    assert.ok(labels.includes("Termini na čekanju"));
    assert.ok(labels.includes("Nedodeljeni termini"));
    assert.ok(labels.includes("Nove poruke"));
    assert.ok(labels.includes("Porudžbine na čekanju"));
  });

  it("passes each stat value through unmodified onto its tile", () => {
    const view = prepareDashboardData(buildStats({ outOfStockProducts: 7 }), {});
    const overviewSection = view.sections.find((s) => s.title === "Pregled");
    const attentionSection = view.sections.find((s) => s.title === "Zahteva pažnju");
    const tile = attentionSection.tiles.find((t) => t.label === "Proizvodi bez zaliha");

    assert.equal(tile.value, 7);
    assert.ok(overviewSection);
  });

  it("maps each pending appointment into a title/subtitle/url activity item", () => {
    const recent = { pendingAppointments: [{ id: "a1", korisnik: "Petar Petrovic", usluga: "Masaza", datum: "01.01.2026. 10:00" }] };
    const view = prepareDashboardData(buildStats(), recent);
    const tab = view.activityTabs.find((t) => t.id === "pending-appointments");

    assert.equal(tab.items[0].title, "Petar Petrovic");
    assert.equal(tab.items[0].subtitle, "Masaza - 01.01.2026. 10:00");
    assert.equal(tab.items[0].url, "/admin/termini/detalji/a1");
  });

  it("shows an empty-state message for each activity tab when its list is empty or missing", () => {
    const view = prepareDashboardData(buildStats(), {});

    for (const tab of view.activityTabs) {
      assert.equal(tab.items.length, 0, `${tab.id} should have no items`);
      assert.ok(tab.emptyText, `${tab.id} must have an emptyText fallback`);
    }
  });

  it("maps recent orders into the 'orders' activity tab - previously fetched but never actually rendered", () => {
    const recent = { orders: [{ id: "o1", korisnik: "Ana Anic", ukupnaCena: "5000 RSD", datum: "01.01.2026." }] };
    const view = prepareDashboardData(buildStats(), recent);
    const ordersTab = view.activityTabs.find((t) => t.id === "orders");

    assert.equal(ordersTab.items.length, 1);
    assert.equal(ordersTab.items[0].title, "Ana Anic");
    assert.equal(ordersTab.items[0].url, "/admin/porudzbine/detalji/o1");
  });

  it("maps unassigned appointments into their own activity tab, distinct from pending ones", () => {
    const recent = { unassignedAppointments: [{ id: "a2", korisnik: "Jovan Jovanović", usluga: "Piling lica", datum: "02.01.2026. 12:00" }] };
    const view = prepareDashboardData(buildStats(), recent);
    const tab = view.activityTabs.find((t) => t.id === "unassigned-appointments");

    assert.equal(tab.items[0].title, "Jovan Jovanović");
    assert.equal(tab.items[0].url, "/admin/termini/detalji/a2");
  });

  it("maps recent contacts into the 'contacts' activity tab", () => {
    const recent = { contacts: [{ id: "c1", imePrezime: "Marko Markovic", email: "marko@example.com", datum: "01.01.2026." }] };
    const view = prepareDashboardData(buildStats(), recent);
    const contactsTab = view.activityTabs.find((t) => t.id === "contacts");

    assert.equal(contactsTab.items[0].subtitle, "marko@example.com - 01.01.2026.");
  });
});