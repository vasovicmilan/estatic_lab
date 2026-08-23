import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareManualAppointmentFormData } from "../../../../../src/presenters/admin/appointment/manual-appointment.presenter.js";

describe("prepareManualAppointmentFormData", () => {
  it("passes services, employeesByService, and userOptions through unmodified", () => {
    const services = [{ id: "svc1", name: "Masaza", variants: [{ id: "p1", name: "60 min", duration: 60, price: 3000 }] }];
    const employeesByService = { svc1: [{ id: "emp1", name: "Ana Anic" }] };
    const userOptions = [{ value: "user1", label: "Marko Markovic (marko@example.com)" }];

    const view = prepareManualAppointmentFormData({ services, employeesByService, userOptions });

    assert.deepEqual(view.services, services);
    assert.deepEqual(view.employeesByService, employeesByService);
    assert.deepEqual(view.userOptions, userOptions);
  });

  it("defaults every collection to empty when called with nothing", () => {
    const view = prepareManualAppointmentFormData();

    assert.deepEqual(view.services, []);
    assert.deepEqual(view.employeesByService, {});
    assert.deepEqual(view.userOptions, []);
  });

  it("posts to the manual creation endpoint and links back to the appointment list", () => {
    const view = prepareManualAppointmentFormData();

    assert.equal(view.formAction, "/admin/termini/rucno-kreiranje");
    assert.equal(view.cancelUrl, "/admin/termini");
  });

  it("ends the breadcrumb trail on the current page (no link)", () => {
    const view = prepareManualAppointmentFormData();

    const last = view.breadcrumbs[view.breadcrumbs.length - 1];
    assert.equal(last.label, "Novi termin (ručno)");
    assert.equal(last.url, null);
  });
});