import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preparePayoutRequestListData,
  preparePayoutRequestDetailsData,
} from "../../../../../src/presenters/admin/marketing/payout-request.presenter.js";

// Input shape mirrors mapPayoutRequestForAdminDetail's real output (see
// payout-request.mapper.js) - presenters only ever receive already-mapped data.
function buildMappedRequest(overrides = {}) {
  return {
    id: "req-1",
    earnerType: "Zaposleni",
    earnerName: "Marko Markovic",
    iznos: "2000 RSD",
    status: "Zatrazeno",
    statusRaw: "requested",
    napomena: null,
    vreme: { zatrazeno: "01.01.2026. 10:00", odobreno: null, isplaceno: null, odbijeno: null },
    ...overrides,
  };
}

describe("preparePayoutRequestListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedRequest()], page: 1, totalPages: 3 };
    const view = preparePayoutRequestListData(result, { status: "requested" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 3);
  });

  it("offers separate status and earner-type filters", () => {
    const view = preparePayoutRequestListData({ data: [], page: 1, totalPages: 1 });
    const filterNames = view.topbar.filters.map((f) => f.name);

    assert.ok(filterNames.includes("status"));
    assert.ok(filterNames.includes("earnerType"));
  });

  it("preselects the status filter's current value from the query", () => {
    const view = preparePayoutRequestListData({ data: [], page: 1, totalPages: 1 }, { status: "paid" });
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");

    assert.equal(statusFilter.value, "paid");
  });
});

describe("preparePayoutRequestDetailsData - actionsByStatus", () => {
  it("offers approve/mark-paid/reject for a 'requested' request", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest({ statusRaw: "requested" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.deepEqual(labels.sort(), ["Odbij", "Odobri", "Označi kao isplaćeno"].sort());
  });

  it("offers only mark-paid/reject for an already-'approved' request - no re-approving", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest({ statusRaw: "approved" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.deepEqual(labels.sort(), ["Odbij", "Označi kao isplaćeno"].sort());
    assert.ok(!labels.includes("Odobri"), "an already-approved request must not be offered 'Odobri' again");
  });

  it("offers no actions at all for a 'paid' request - a terminal state", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest({ statusRaw: "paid" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.deepEqual(actions, []);
  });

  it("offers no actions at all for a 'rejected' request - also terminal", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest({ statusRaw: "rejected" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.deepEqual(actions, []);
  });

  it("shows '-' placeholders for timestamps that haven't happened yet", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest());
    const timeSection = view.sidebar.find((s) => s.title === "Vreme");
    const odobreno = timeSection.rows.find((r) => r.label === "Odobreno");

    assert.equal(odobreno.value, "-");
  });

  it("shows the real timestamp once a stage has actually happened", () => {
    const view = preparePayoutRequestDetailsData(
      buildMappedRequest({ statusRaw: "paid", vreme: { zatrazeno: "01.01.2026.", odobreno: "02.01.2026.", isplaceno: "03.01.2026.", odbijeno: null } })
    );
    const timeSection = view.sidebar.find((s) => s.title === "Vreme");

    assert.equal(timeSection.rows.find((r) => r.label === "Odobreno").value, "02.01.2026.");
    assert.equal(timeSection.rows.find((r) => r.label === "Isplaćeno").value, "03.01.2026.");
  });

  it("uses the earner's name as the last breadcrumb", () => {
    const view = preparePayoutRequestDetailsData(buildMappedRequest({ earnerName: "Ana Anic" }));
    assert.equal(view.breadcrumbs.at(-1).label, "Ana Anic");
  });
});