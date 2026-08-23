import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareAdminProfileFormData } from "../../../../src/presenters/admin/profile.presenter.js";

describe("prepareAdminProfileFormData", () => {
  it("pre-fills the form with the admin's current name/phone/email", () => {
    const view = prepareAdminProfileFormData({ firstName: "Milan", lastName: "Vasovic", telefon: "0601234567", email: "milan@example.com" });
    const byName = (n) => view.fields.find((f) => f.name === n);

    assert.equal(byName("firstName").value, "Milan");
    assert.equal(byName("lastName").value, "Vasovic");
    assert.equal(byName("phone").value, "0601234567");
    assert.equal(byName("email").value, "milan@example.com");
  });

  it("disables the email field - it can't be changed from this form", () => {
    const view = prepareAdminProfileFormData({ firstName: "Milan", lastName: "Vasovic", email: "milan@example.com" });
    const emailField = view.fields.find((f) => f.name === "email");

    assert.equal(emailField.disabled, true);
  });

  it("defaults phone to an empty string when the admin hasn't set one", () => {
    const view = prepareAdminProfileFormData({ firstName: "Milan", lastName: "Vasovic", email: "milan@example.com", telefon: undefined });
    assert.equal(view.fields.find((f) => f.name === "phone").value, "");
  });

  it("always posts to /admin/profil", () => {
    const view = prepareAdminProfileFormData({ firstName: "Milan", lastName: "Vasovic", email: "milan@example.com" });
    assert.equal(view.formAction, "/admin/profil");
    assert.equal(view.isEdit, true);
  });
});