import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareResourceListData,
  prepareResourceDetailsData,
  prepareResourceFormData,
} from "../../../../../src/presenters/admin/catalog/resource.presenter.js";

function buildMappedResource(overrides = {}) {
  return {
    id: "resource-1",
    naziv: "Soba za masazu 1",
    kapacitet: 1,
    aktivan: true,
    napomena: null,
    vreme: { kreiran: "01.01.2026. 10:00", azuriran: "01.01.2026. 10:00" },
    ...overrides,
  };
}

describe("prepareResourceListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedResource()], page: 1, totalPages: 2 };
    const view = prepareResourceListData(result, { search: "masaza" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
    assert.equal(view.topbar.search, "masaza");
  });
});

describe("prepareResourceDetailsData", () => {
  it("shows the capacity and active status", () => {
    const view = prepareResourceDetailsData(buildMappedResource({ kapacitet: 2, aktivan: false }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label.startsWith("Kapacitet")).value, 2);
    assert.equal(section.rows.find((r) => r.label === "Aktivan").value, "Ne");
  });

  it("shows a placeholder when there's no note", () => {
    const view = prepareResourceDetailsData(buildMappedResource({ napomena: null }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Napomena").value, "-");
  });

  it("uses the resource's name as the last breadcrumb", () => {
    const view = prepareResourceDetailsData(buildMappedResource({ naziv: "ESMA aparat" }));
    assert.equal(view.breadcrumbs.at(-1).label, "ESMA aparat");
  });
});

describe("prepareResourceFormData", () => {
  it("defaults capacity to 1 and isActive to true on create", () => {
    const view = prepareResourceFormData();
    const capacityField = view.fields.find((f) => f.name === "capacity");
    const activeField = view.fields.find((f) => f.name === "isActive");

    assert.equal(capacityField.value, 1);
    assert.equal(activeField.value, true);
    assert.equal(view.isEdit, false);
  });

  it("points the form action at POST /admin/resursi on create, PUT .../:id on edit", () => {
    const createView = prepareResourceFormData();
    const editView = prepareResourceFormData({ id: "r1", name: "Soba 2", capacity: 2, isActive: true, notes: "" });

    assert.equal(createView.formAction, "/admin/resursi");
    assert.equal(editView.formAction, "/admin/resursi/r1");
    assert.equal(editView.isEdit, true);
  });

  it("pre-fills the form with the resource's current values on edit", () => {
    const view = prepareResourceFormData({ id: "r1", name: "Soba 2", capacity: 3, isActive: false, notes: "Renovira se" });
    const nameField = view.fields.find((f) => f.name === "name");
    const notesField = view.fields.find((f) => f.name === "notes");

    assert.equal(nameField.value, "Soba 2");
    assert.equal(notesField.value, "Renovira se");
  });
});