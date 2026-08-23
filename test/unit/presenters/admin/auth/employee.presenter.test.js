import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareEmployeeListData, prepareEmployeeDetailsData, prepareEmployeeFormData } from "../../../../../src/presenters/admin/auth/employee.presenter.js";

function buildMappedEmployee(overrides = {}) {
  return {
    id: "emp-1",
    korisnik: { imePrezime: "Ana Anic", email: "ana@example.com", telefon: "0601234567" },
    povezaniEkspert: null,
    usluge: ["Masaza", "Piling lica"],
    radnoVreme: [{ dan: "Ponedeljak", termini: ["09:00-17:00"] }],
    aktivan: true,
    nacinIsplate: "Fiksna plata",
    procenatProvizije: null,
    napomena: null,
    googleCalendarId: null,
    sredimeIcsUrl: null,
    vreme: { kreiran: "01.01.2026.", azuriran: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareEmployeeListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedEmployee()], page: 1, totalPages: 2 };
    const view = prepareEmployeeListData(result, { search: "ana" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("offers an active/inactive status filter", () => {
    const view = prepareEmployeeListData({ data: [], page: 1, totalPages: 1 });
    const statusFilter = view.topbar.filters.find((f) => f.name === "isActive");

    assert.deepEqual(statusFilter.options.map((o) => o.value), ["", "true", "false"]);
  });
});

describe("prepareEmployeeDetailsData", () => {
  it("shows 'Nije povezan' when the employee has no linked expert profile", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee({ povezaniEkspert: null }));
    const section = view.sections.find((s) => s.title === "Podaci o korisniku");

    assert.equal(section.rows.find((r) => r.label === "Povezan ekspert profil").value, "Nije povezan");
  });

  it("shows the linked expert's name when one exists", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee({ povezaniEkspert: { imePrezime: "Ana Anic (Ekspert)" } }));
    const section = view.sections.find((s) => s.title === "Podaci o korisniku");

    assert.equal(section.rows.find((r) => r.label === "Povezan ekspert profil").value, "Ana Anic (Ekspert)");
  });

  it("shows 'Neradni dan' for a working-hours day with no time slots", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee({ radnoVreme: [{ dan: "Nedelja", termini: [] }] }));
    const workingHoursSection = view.sections.find((s) => s.title === "Radno vreme");

    assert.equal(workingHoursSection.rows[0].value, "Neradni dan");
  });

  it("omits the commission-rate row entirely for a salaried employee", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee({ procenatProvizije: null }));
    const statusSection = view.sidebar.find((s) => s.title === "Status");

    assert.ok(!statusSection.rows.some((r) => r.label === "Procenat provizije"));
  });

  it("shows the commission rate row for a commission-based employee", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee({ procenatProvizije: "20%" }));
    const statusSection = view.sidebar.find((s) => s.title === "Status");

    assert.equal(statusSection.rows.find((r) => r.label === "Procenat provizije").value, "20%");
  });

  it("omits the payout-record form entirely when no balance is passed", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee());
    assert.ok(!view.sidebar.some((s) => s.title === "Zabeleži isplatu"));
  });

  it("includes the payout-record form with the formatted available balance when one is passed", () => {
    const view = prepareEmployeeDetailsData(buildMappedEmployee(), { earned: 5000, paid: 0, reserved: 0, available: 2500.7 });
    const payoutForm = view.sidebar.find((s) => s.title === "Zabeleži isplatu");

    assert.equal(payoutForm.data.earnerType, "employee");
    assert.equal(payoutForm.data.available, 2501);
  });
});

describe("prepareEmployeeFormData", () => {
  it("includes the userId select only on create", () => {
    const createView = prepareEmployeeFormData(null, { userOptions: [{ value: "u1", label: "Ana" }] });
    const editView = prepareEmployeeFormData({ id: "e1", payType: "salary" });

    assert.ok(createView.fields.some((f) => f.name === "userId"));
    assert.ok(!editView.fields.some((f) => f.name === "userId"));
  });

  it("translates all 7 weekdays into the schedule field's day options", () => {
    const view = prepareEmployeeFormData(null, {});
    const scheduleField = view.fields.find((f) => f.name === "workingHours");

    assert.equal(scheduleField.days.length, 7);
    assert.equal(scheduleField.days[0].label, "Ponedeljak");
    assert.equal(scheduleField.days[6].label, "Nedelja");
  });

  it("normalizes a populated expert object down to just its id", () => {
    const view = prepareEmployeeFormData({ id: "e1", payType: "salary", expert: { id: "ex1", imePrezime: "Ana" } }, {});
    const expertField = view.fields.find((f) => f.name === "expert");

    assert.equal(expertField.value, "ex1");
  });

  it("normalizes a mixed array of populated service objects and raw ids into plain id strings", () => {
    const view = prepareEmployeeFormData({ id: "e1", payType: "salary", services: [{ id: "s1" }, "s2"] }, {});
    const servicesField = view.fields.find((f) => f.name === "services");

    assert.deepEqual(servicesField.value, ["s1", "s2"]);
  });

  it("defaults payType to 'salary' on create", () => {
    const view = prepareEmployeeFormData(null, {});
    assert.equal(view.fields.find((f) => f.name === "payType").value, "salary");
  });

  it("points the form action at POST /admin/zaposleni on create, PUT .../:id on edit", () => {
    const createView = prepareEmployeeFormData(null, {});
    const editView = prepareEmployeeFormData({ id: "e1", payType: "salary" }, {});

    assert.equal(createView.formAction, "/admin/zaposleni");
    assert.equal(editView.formAction, "/admin/zaposleni/e1");
  });
});