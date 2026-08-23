import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareRoleListData, prepareRoleDetailsData, prepareRoleFormData } from "../../../../../src/presenters/admin/auth/role.presenter.js";

function buildMappedRole(overrides = {}) {
  return {
    id: "role-1",
    osnovno: { naziv: "seo", opis: "SEO urednik", podrazumevana: false, prioritet: 10 },
    permisije: [{ value: "manage_blog", naziv: "Upravljanje blogom" }],
    vreme: { kreirano: "01.01.2026.", azurirano: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareRoleListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedRole()], page: 1, totalPages: 2 };
    const view = prepareRoleListData(result, { search: "seo" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });
});

describe("prepareRoleDetailsData", () => {
  it("shows a placeholder when the role has no description", () => {
    const view = prepareRoleDetailsData(buildMappedRole({ osnovno: { naziv: "seo", opis: null, podrazumevana: false, prioritet: 10 } }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Opis").value, "-");
  });

  it("lists each permission by its display name", () => {
    const view = prepareRoleDetailsData(
      buildMappedRole({ permisije: [{ value: "manage_blog", naziv: "Upravljanje blogom" }, { value: "manage_orders", naziv: "Upravljanje porudzbinama" }] })
    );
    const permissionsSection = view.sections.find((s) => s.title === "Permisije");

    assert.deepEqual(permissionsSection.items, ["Upravljanje blogom", "Upravljanje porudzbinama"]);
  });

  it("uses the role's name as the last breadcrumb", () => {
    const view = prepareRoleDetailsData(buildMappedRole({ osnovno: { naziv: "blog-urednik", opis: null, podrazumevana: false, prioritet: 5 } }));
    assert.equal(view.breadcrumbs.at(-1).label, "blog-urednik");
  });
});

describe("prepareRoleFormData", () => {
  it("locks the name field and explains why, for a reserved system role like 'admin'", () => {
    const view = prepareRoleFormData({ id: "r1", name: "admin", description: "", permissions: [], isDefault: false, priority: 100 }, []);
    const nameField = view.fields.find((f) => f.name === "name");

    assert.equal(nameField.disabled, true);
    assert.match(nameField.help, /rezervisan naziv/);
  });

  it("leaves the name field editable for a custom, non-reserved role", () => {
    const view = prepareRoleFormData({ id: "r1", name: "seo", description: "", permissions: [], isDefault: false, priority: 10 }, []);
    const nameField = view.fields.find((f) => f.name === "name");

    assert.equal(nameField.disabled, false);
  });

  it("is never locked on create, since there's no existing reserved name to protect yet", () => {
    const view = prepareRoleFormData(null, []);
    const nameField = view.fields.find((f) => f.name === "name");

    assert.equal(nameField.disabled, false);
    assert.equal(view.isEdit, false);
  });

  it("normalizes a mixed array of permission objects and raw strings into plain value strings", () => {
    const view = prepareRoleFormData(
      { id: "r1", name: "seo", description: "", permissions: [{ value: "manage_blog" }, "manage_orders"], isDefault: false, priority: 10 },
      []
    );
    const permissionsField = view.fields.find((f) => f.name === "permissions");

    assert.deepEqual(permissionsField.value, ["manage_blog", "manage_orders"]);
  });

  it("points the form action at POST /admin/role on create, PUT .../:id on edit", () => {
    const createView = prepareRoleFormData(null, []);
    const editView = prepareRoleFormData({ id: "r1", name: "seo", description: "", permissions: [], isDefault: false, priority: 10 }, []);

    assert.equal(createView.formAction, "/admin/role");
    assert.equal(editView.formAction, "/admin/role/r1");
  });
});