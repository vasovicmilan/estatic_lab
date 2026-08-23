import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareOrderListData, prepareOrderDetailsData } from "../../../../../src/presenters/admin/order/order.presenter.js";

// Input shape mirrors mapOrderForAdminDetail's real output (see order.mapper.js).
// prepareOrderDetailsData calls the REAL getAllowedStatuses (order-status-transitions.js),
// not a mock - so statusRaw values and expected actions below must match that
// file's actual transition table.
function buildMappedOrder(overrides = {}) {
  return {
    id: "order-1",
    korisnik: { ime: "Petar Petrovic", email: "petar@example.com", telefon: "0601234567" },
    adresa: { grad: "Novi Sad", postanskiBroj: "21000", ulica: "Bulevar", broj: "10" },
    stavke: [{ naziv: "ESMA Uredjaj", varijanta: "Standard", kolicina: 1, cena: 250000, ukupno: 250000 }],
    subtotal: 250000,
    dostava: 500,
    kupon: null,
    popust: 0,
    ukupnaCena: "250500 RSD",
    status: "Na čekanju",
    statusRaw: "pending",
    otkazao: null,
    otkazanoU: null,
    razlogOtkazivanja: null,
    razlogVracanja: null,
    napomena: null,
    vreme: { naruceno: "01.01.2026. 10:00", uObradiOd: null, poslatoU: null, dostavljenoU: null, zavrsenoU: null },
    ...overrides,
  };
}

describe("prepareOrderListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedOrder()], page: 1, totalPages: 3 };
    const view = prepareOrderListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 3);
  });

  it("offers a status filter with every order status as an option", () => {
    const view = prepareOrderListData({ data: [], page: 1, totalPages: 1 });
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");
    const values = statusFilter.options.map((o) => o.value);

    for (const s of ["pending", "processing", "shipped", "delivered", "completed", "cancelled", "returned", "refunded"]) {
      assert.ok(values.includes(s), `missing filter option for status "${s}"`);
    }
  });

  it("offers date-range filters", () => {
    const view = prepareOrderListData({ data: [], page: 1, totalPages: 1 }, { dateFrom: "2026-01-01", dateTo: "2026-01-31" });
    assert.equal(view.topbar.filters.find((f) => f.name === "dateFrom").value, "2026-01-01");
    assert.equal(view.topbar.filters.find((f) => f.name === "dateTo").value, "2026-01-31");
  });
});

describe("prepareOrderDetailsData - statusActions via the real transition table", () => {
  it("offers 'process' and 'cancel' for a 'pending' order", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "pending" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.deepEqual(labels.sort(), ["Otkaži porudžbinu", "Označi kao u obradi"].sort());
  });

  it("offers only 'ship' and 'cancel' for a 'processing' order - not back to pending", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "processing" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.deepEqual(labels.sort(), ["Otkaži porudžbinu", "Označi kao poslato"].sort());
  });

  it("offers no actions at all for a 'completed' order - a terminal state", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "completed" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.deepEqual(actions, []);
  });

  it("offers 'refund' as the only action for a 'returned' order", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "returned" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.equal(actions.length, 1);
    assert.equal(actions[0].label, "Označi kao refundirano");
  });

  it("offers 'reopen' for a 'cancelled' order - admin can undo a mistaken cancellation", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "cancelled" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.equal(actions.length, 1);
    assert.equal(actions[0].label, "Ponovo otvori porudžbinu");
  });

  it("marks 'cancel' and 'return' as needing a reason, but not the routine progress actions", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ statusRaw: "pending" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const cancelAction = actions.find((a) => a.label === "Otkaži porudžbinu");
    const processAction = actions.find((a) => a.label === "Označi kao u obradi");

    assert.equal(cancelAction.needsReason, true);
    assert.equal(processAction.needsReason, false);
  });

  it("shows the cancellation/return reason section only populated once an order was actually cancelled/returned", () => {
    const untouched = prepareOrderDetailsData(buildMappedOrder());
    const cancelled = prepareOrderDetailsData(
      buildMappedOrder({ statusRaw: "cancelled", otkazao: "Admin Nalog", razlogOtkazivanja: "Kupac je pogresno narucio" })
    );

    const untouchedSection = untouched.sidebar.find((s) => s.title === "Otkazivanje/vraćanje");
    const cancelledSection = cancelled.sidebar.find((s) => s.title === "Otkazivanje/vraćanje");

    assert.equal(untouchedSection.rows.find((r) => r.label === "Otkazao").value, "-");
    assert.equal(cancelledSection.rows.find((r) => r.label === "Otkazao").value, "Admin Nalog");
    assert.equal(cancelledSection.rows.find((r) => r.label === "Razlog otkazivanja").value, "Kupac je pogresno narucio");
  });

  it("shows a placeholder when there's no saved address", () => {
    const view = prepareOrderDetailsData(buildMappedOrder({ adresa: null }));
    const addressSection = view.sections.find((s) => s.title === "Adresa za dostavu");

    assert.equal(addressSection.rows[0].value, "-");
  });

  it("lists each item with its line total, not just unit price x quantity separately", () => {
    const view = prepareOrderDetailsData(
      buildMappedOrder({ stavke: [{ naziv: "Krema", varijanta: "50ml", kolicina: 2, cena: 1500, ukupno: 3000 }] })
    );
    const itemsSection = view.sections.find((s) => s.title === "Stavke");

    assert.equal(itemsSection.rows[0].value, "2 x 1500 RSD = 3000 RSD");
  });
});