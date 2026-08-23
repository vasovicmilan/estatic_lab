import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareLoginFormData,
  prepareRegisterFormData,
  prepareForgotPasswordFormData,
  prepareResetPasswordFormData,
  prepareClaimAccountData,
} from "../../../../src/presenters/auth/auth.presenter.js";

describe("prepareLoginFormData", () => {
  it("defaults errors/formData to empty and redirectTo to home", () => {
    const view = prepareLoginFormData();
    assert.deepEqual(view.errors, {});
    assert.equal(view.formData.email, "");
    assert.equal(view.redirectTo, "/");
  });

  it("preserves an intended redirect target across a failed login attempt", () => {
    const view = prepareLoginFormData({ redirectTo: "/korpa/naplata" });
    assert.equal(view.redirectTo, "/korpa/naplata");
  });

  it("re-shows the submitted email after a failed attempt, but never the password", () => {
    const view = prepareLoginFormData({ formData: { email: "petar@example.com", password: "secret123" } });
    assert.equal(view.formData.email, "petar@example.com");
    assert.ok(!("password" in view.formData));
  });
});

describe("prepareRegisterFormData", () => {
  it("re-shows all submitted contact fields after a failed attempt, but never the password", () => {
    const view = prepareRegisterFormData({
      formData: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", phone: "0601234567", password: "secret" },
    });

    assert.equal(view.formData.firstName, "Petar");
    assert.equal(view.formData.phone, "0601234567");
    assert.ok(!("password" in view.formData));
  });
});

describe("prepareForgotPasswordFormData", () => {
  it("re-shows the submitted email after a failed attempt", () => {
    const view = prepareForgotPasswordFormData({ formData: { email: "petar@example.com" } });
    assert.equal(view.formData.email, "petar@example.com");
  });
});

describe("prepareResetPasswordFormData", () => {
  it("embeds the token directly into the form action URL", () => {
    const view = prepareResetPasswordFormData("abc123");
    assert.equal(view.formAction, "/resetovanje-lozinke/abc123");
  });

  it("shows a distinct 'claim your account' heading for a guest-account claim vs a plain password reset", () => {
    const claim = prepareResetPasswordFormData("abc123", { isAccountClaim: true });
    const reset = prepareResetPasswordFormData("abc123", { isAccountClaim: false });

    assert.equal(claim.breadcrumbs[0].label, "Preuzmite vaš nalog");
    assert.equal(reset.breadcrumbs[0].label, "Nova lozinka");
  });
});

describe("prepareClaimAccountData", () => {
  it("embeds the user's own claim token into the form action", () => {
    const view = prepareClaimAccountData({ email: "petar@example.com", imePrezime: "Petar Petrovic", claimToken: "tok123" });
    assert.equal(view.formAction, "/preuzmi-nalog/tok123");
  });
});