import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareSiteSettingsFormData } from "../../../../../src/presenters/admin/marketing/site-settings.presenter.js";

describe("prepareSiteSettingsFormData", () => {
  it("carries the existing hero image through as the file field's preview", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: "/images/site/hero-abc-medium.webp", imageAlt: "Salon enterijer" } });

    const imageField = view.fields.find((f) => f.name === "heroImage");
    assert.equal(imageField.preview, "/images/site/hero-abc-medium.webp");
    assert.equal(imageField.type, "file");

    const altField = view.fields.find((f) => f.name === "heroImageAlt");
    assert.equal(altField.value, "Salon enterijer");
  });

  it("shows no preview when no hero image has been set yet", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: null, imageAlt: "" } });

    const imageField = view.fields.find((f) => f.name === "heroImage");
    assert.equal(imageField.preview, null);

    const altField = view.fields.find((f) => f.name === "heroImageAlt");
    assert.equal(altField.value, "");
  });

  it("doesn't crash when called with no settings at all", () => {
    const view = prepareSiteSettingsFormData(undefined);

    assert.equal(view.fields.find((f) => f.name === "heroImage").preview, null);
    assert.equal(view.fields.find((f) => f.name === "heroImageAlt").value, "");
  });

  it("hero fields stay optional - a settings save doesn't have to touch the image every time", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: "/images/site/x-medium.webp", imageAlt: "" } });

    const heroFields = view.fields.filter((f) => f.name === "heroImage" || f.name === "heroImageAlt");
    assert.equal(heroFields.every((f) => f.required === false), true);
  });

  it("booking policy and currency fields are required - the form always submits a complete set", () => {
    const view = prepareSiteSettingsFormData({
      bookingPolicy: {
        bufferMinutes: 30,
        slotGridMinutes: 30,
        userCancellationCutoffHours: 24,
        rescheduleCutoffHours: 24,
        rescheduleSameDayFloorHours: 4,
        rescheduleMinLeadMinutes: 30,
      },
      currency: { code: "RSD", symbol: "RSD", symbolPosition: "after" },
    });

    const policyAndCurrencyFields = view.fields.filter((f) => f.name !== "heroImage" && f.name !== "heroImageAlt");
    assert.ok(policyAndCurrencyFields.length > 0);
    assert.equal(policyAndCurrencyFields.every((f) => f.required === true), true);
  });

  it("carries booking policy values through, defaulting currency to RSD/after when unset", () => {
    const view = prepareSiteSettingsFormData({
      bookingPolicy: { bufferMinutes: 45, rescheduleCutoffHours: 48 },
      currency: {},
    });

    assert.equal(view.fields.find((f) => f.name === "bufferMinutes").value, 45);
    assert.equal(view.fields.find((f) => f.name === "rescheduleCutoffHours").value, 48);
    assert.equal(view.fields.find((f) => f.name === "currencyCode").value, "RSD");
    assert.equal(view.fields.find((f) => f.name === "currencySymbolPosition").value, "after");
  });

  it("marks the first booking-policy field and the first currency field with a sectionTitle", () => {
    const view = prepareSiteSettingsFormData(undefined);

    const sectioned = view.fields.filter((f) => f.sectionTitle);
    assert.equal(sectioned.length, 2);
    assert.equal(sectioned[0].name, "bufferMinutes");
    assert.equal(sectioned[1].name, "currencyCode");
  });

  it("posts to /admin/sajt as multipart, since the form can upload a file", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: null, imageAlt: "" } });

    assert.equal(view.formAction, "/admin/sajt");
    assert.equal(view.formEnctype, "multipart/form-data");
  });
});