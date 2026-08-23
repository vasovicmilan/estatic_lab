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

  it("neither field is marked required, since both are optional on every submit", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: "/images/site/x-medium.webp", imageAlt: "" } });

    assert.equal(view.fields.every((f) => f.required === false), true);
  });

  it("posts to /admin/sajt as multipart, since the form can upload a file", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: null, imageAlt: "" } });

    assert.equal(view.formAction, "/admin/sajt");
    assert.equal(view.formEnctype, "multipart/form-data");
  });
});