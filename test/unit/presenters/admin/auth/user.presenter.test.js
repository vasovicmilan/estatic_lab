import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareUserListData, prepareUserDetailsData, prepareUserEditFormData } from "../../../../../src/presenters/admin/auth/user.presenter.js";

function buildMappedUser(overrides = {}) {
  return {
    id: "user-1",
    imePrezime: "Petar Petrovic",
    firstName: "Petar",
    lastName: "Petrovic",
    email: "petar@example.com",
    telefon: "0601234567",
    uloga: "Korisnik",
    roleId: "role-user",
    status: "Aktivan",
    statusRaw: "active",
    nacinPrijave: "Email",
    potvrdjenEmail: "Da",
    avatar: null,
    poslednjiLogin: "01.01.2026.",
    vreme: { registrovan: "01.01.2026.", azuriran: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareUserListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedUser()], page: 1, totalPages: 2 };
    const view = prepareUserListData(result, { search: "petar" }, []);

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });

  it("translates role options into a filter, keeping the actual role id as the value", () => {
    const view = prepareUserListData({ data: [], page: 1, totalPages: 1 }, {}, [{ id: "role-partner", naziv: "Partner" }]);
    const roleFilter = view.topbar.filters.find((f) => f.name === "role");

    assert.deepEqual(roleFilter.options[1], { value: "role-partner", label: "Partner" });
  });

  it("offers all 5 account statuses as filter options", () => {
    const view = prepareUserListData({ data: [], page: 1, totalPages: 1 }, {}, []);
    const statusFilter = view.topbar.filters.find((f) => f.name === "status");

    assert.deepEqual(statusFilter.options.map((o) => o.value), ["", "guest", "pending", "active", "inactive", "suspended"]);
  });

  it("has no create action - users are never created directly from this list", () => {
    const view = prepareUserListData({ data: [], page: 1, totalPages: 1 }, {}, []);
    assert.ok(!("createUrl" in view.topbar));
  });
});

describe("prepareUserDetailsData", () => {
  it("shows a placeholder when there's no saved phone number", () => {
    const view = prepareUserDetailsData(buildMappedUser({ telefon: null }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.equal(section.rows.find((r) => r.label === "Telefon").value, "-");
  });

  it("includes package-purchase quick links scoped to this specific user", () => {
    const view = prepareUserDetailsData(buildMappedUser({ id: "u1" }));
    const section = view.sections.find((s) => s.title === "Osnovni podaci");

    assert.match(section.rows.find((r) => r.label === "Kupljeni paketi").value, /userId=u1/);
  });

  it("omits the avatar section entirely when the user has none", () => {
    const view = prepareUserDetailsData(buildMappedUser({ avatar: null }));
    assert.ok(!view.sections.some((s) => s.title === "Avatar"));
  });

  it("includes an avatar section rendering an <img> when the user has one", () => {
    const view = prepareUserDetailsData(buildMappedUser({ avatar: "/images/avatars/x.webp" }));
    const avatarSection = view.sections.find((s) => s.title === "Avatar");

    assert.match(avatarSection.content, /<img src="\/images\/avatars\/x\.webp"/);
  });

  it("shows 'Nikada' for a user who has never logged in", () => {
    const view = prepareUserDetailsData(buildMappedUser({ poslednjiLogin: null }));
    const timeSection = view.sidebar.find((s) => s.title === "Vreme");

    assert.equal(timeSection.rows.find((r) => r.label === "Poslednji login").value, "Nikada");
  });

  it("only offers the email-verify action for a 'pending' account, not an already-active one", () => {
    const pending = prepareUserDetailsData(buildMappedUser({ statusRaw: "pending" }));
    const active = prepareUserDetailsData(buildMappedUser({ statusRaw: "active" }));

    const pendingActions = pending.sidebar.find((s) => s.title === "Izmena uloge/statusa").data;
    const activeActions = active.sidebar.find((s) => s.title === "Izmena uloge/statusa").data;

    assert.equal(pendingActions.showVerifyAction, true);
    assert.equal(activeActions.showVerifyAction, false);
  });

  it("passes the current role id and available role options through for the role-change form", () => {
    const view = prepareUserDetailsData(buildMappedUser({ roleId: "role-partner" }), [{ id: "role-partner", naziv: "Partner" }]);
    const actionsData = view.sidebar.find((s) => s.title === "Izmena uloge/statusa").data;

    assert.equal(actionsData.currentRoleId, "role-partner");
    assert.deepEqual(actionsData.roleOptions, [{ id: "role-partner", naziv: "Partner" }]);
  });

  it("uses the user's name as the last breadcrumb", () => {
    const view = prepareUserDetailsData(buildMappedUser({ imePrezime: "Ana Anic" }));
    assert.equal(view.breadcrumbs.at(-1).label, "Ana Anic");
  });
});

describe("prepareUserEditFormData", () => {
  it("disables the email field - it can't be changed from this form", () => {
    const view = prepareUserEditFormData(buildMappedUser());
    const emailField = view.fields.find((f) => f.name === "email");

    assert.equal(emailField.disabled, true);
  });

  it("does not expose a role or status field - those go through their own dedicated actions, not this form", () => {
    const view = prepareUserEditFormData(buildMappedUser());
    assert.ok(!view.fields.some((f) => f.name === "role" || f.name === "status"));
  });

  it("cancels back to the user's own detail page", () => {
    const view = prepareUserEditFormData(buildMappedUser({ id: "u1" }));
    assert.equal(view.cancelUrl, "/admin/korisnici/detalji/u1");
  });
});