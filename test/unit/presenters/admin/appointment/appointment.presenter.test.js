import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareAppointmentListData, prepareAppointmentDetailsData } from "../../../../../src/presenters/admin/appointment/appointment.presenter.js";

function buildMappedAppointment(overrides = {}) {
  return {
    id: "apt-1",
    korisnik: { ime: "Petar Petrovic", email: "petar@example.com", telefon: "0601234567" },
    usluga: { naziv: "Masaza", trajanje: "60 min", cena: "3000 RSD" },
    termin: { pocetak: "01.01.2026. 10:00", kraj: "01.01.2026. 11:00", pocetakRaw: "2026-01-01T10:00:00Z" },
    terapeut: "Ana Anic",
    terapeutId: "emp-1",
    kupon: null,
    popust: null,
    konacnaCena: "3000 RSD",
    status: "Na čekanju",
    statusRaw: "pending",
    potvrdio: null,
    potvrdjenU: null,
    odbio: null,
    razlogOdbijanja: null,
    otkazao: null,
    razlogOtkazivanja: null,
    oznacioNeDosao: null,
    neDosaoU: null,
    napomenaNeDosao: null,
    dodelio: null,
    napomena: null,
    createdAt: "01.01.2026.",
    updatedAt: "01.01.2026.",
    ...overrides,
  };
}

describe("prepareAppointmentListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedAppointment()], page: 1, totalPages: 2 };
    const view = prepareAppointmentListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("offers a status filter covering all 6 appointment statuses", () => {
    const view = prepareAppointmentListData({ data: [], page: 1, totalPages: 1 });
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");

    assert.deepEqual(statusFilter.options.map((o) => o.value), ["", "pending", "confirmed", "rejected", "cancelled", "completed", "no_show"]);
  });

  it("offers an 'unassigned only' filter, separate from status", () => {
    const view = prepareAppointmentListData({ data: [], page: 1, totalPages: 1 });
    const filter = view.topbar.filters.find((f) => f.name === "unassignedOnly");

    assert.deepEqual(filter.options.map((o) => o.value), ["", "true"]);
  });
});

describe("prepareAppointmentDetailsData - statusActions via the real transition table", () => {
  it("offers 'confirm', 'reject', and 'cancel' for a 'pending' appointment", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "pending" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.deepEqual(labels.sort(), ["Odbij termin", "Otkaži termin", "Potvrdi termin"].sort());
  });

  it("offers 'complete', 'no-show', and 'cancel' for a 'confirmed' appointment - not 'confirm' again", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "confirmed" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;
    const labels = actions.map((a) => a.label);

    assert.ok(!labels.includes("Potvrdi termin"));
    assert.ok(labels.includes("Označi kao završen"));
    assert.ok(labels.includes("Klijent se nije pojavio"));
  });

  it("offers no actions at all for a 'completed' appointment - a terminal state", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "completed" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.deepEqual(actions, []);
  });

  it("marks reject/cancel/no-show as needing a reason, but not confirm/complete", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "pending" }));
    const actions = view.sidebar.find((s) => s.title === "Promena statusa").data.actions;

    assert.equal(actions.find((a) => a.label === "Potvrdi termin").needsReason, false);
    assert.equal(actions.find((a) => a.label === "Odbij termin").needsReason, true);
  });

  it("shows 'Nije dodeljen' when no therapist is assigned yet", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ terapeut: null }));
    const section = view.sections.find((s) => s.title === "Usluga i termin");

    assert.equal(section.rows.find((r) => r.label === "Terapeut").value, "Nije dodeljen");
  });

  it("includes the reschedule form for a 'pending' or 'confirmed' appointment", () => {
    const pending = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "pending" }));
    const confirmed = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "confirmed" }));

    assert.ok(pending.sidebar.some((s) => s.title === "Pomeri termin"));
    assert.ok(confirmed.sidebar.some((s) => s.title === "Pomeri termin"));
  });

  it("omits the reschedule form for a completed appointment - nothing left to move", () => {
    const completed = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "completed" }));
    assert.ok(!completed.sidebar.some((s) => s.title === "Pomeri termin"));
  });

  it("shows placeholders for all history fields on a still-pending appointment with no history yet", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment());
    const historySection = view.sidebar.find((s) => s.title === "Istorija");

    assert.ok(historySection.rows.every((r) => r.value === "-"));
  });

  it("shows the real rejection reason once an appointment has actually been rejected", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ statusRaw: "rejected", odbio: "Admin Nalog", razlogOdbijanja: "Termin nije dostupan" }));
    const historySection = view.sidebar.find((s) => s.title === "Istorija");

    assert.equal(historySection.rows.find((r) => r.label === "Odbio").value, "Admin Nalog");
    assert.equal(historySection.rows.find((r) => r.label === "Razlog odbijanja").value, "Termin nije dostupan");
  });

  it("passes the current employee assignment and available options through to the assignment widget", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ terapeutId: "emp-1" }), { employeeOptions: [{ id: "emp-1", naziv: "Ana" }] });
    const assignmentSection = view.sidebar.find((s) => s.title === "Terapeut");

    assert.equal(assignmentSection.data.currentEmployeeId, "emp-1");
    assert.deepEqual(assignmentSection.data.employeeOptions, [{ id: "emp-1", naziv: "Ana" }]);
  });

  it("uses the customer's name as the last breadcrumb", () => {
    const view = prepareAppointmentDetailsData(buildMappedAppointment({ korisnik: { ime: "Ana Anic", email: "a@example.com" } }));
    assert.equal(view.breadcrumbs.at(-1).label, "Ana Anic");
  });
});