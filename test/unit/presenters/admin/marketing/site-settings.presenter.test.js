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

  it("marks the first field of each section (booking policy, commission, currency) with a sectionTitle", () => {
    const view = prepareSiteSettingsFormData(undefined);

    const sectioned = view.fields.filter((f) => f.sectionTitle);
    assert.equal(sectioned.length, 3);
    assert.equal(sectioned[0].name, "bufferMinutes");
    assert.equal(sectioned[1].name, "minimumSessionCommission");
    assert.equal(sectioned[2].name, "currencyCode");
  });

  it("posts to /admin/sajt as multipart, since the form can upload a file", () => {
    const view = prepareSiteSettingsFormData({ hero: { image: null, imageAlt: "" } });

    assert.equal(view.formAction, "/admin/sajt");
    assert.equal(view.formEnctype, "multipart/form-data");
  });

  describe("workingHoursField (radno vreme, own form)", () => {
    it("is kept out of the main `fields` array - it posts to its own route, not /admin/sajt", () => {
      const view = prepareSiteSettingsFormData(undefined);

      assert.equal(view.fields.some((f) => f.name === "workingHours"), false);
      assert.equal(view.workingHoursField.type, "day-hours");
      assert.equal(view.workingHoursFormAction, "/admin/sajt/radno-vreme");
    });

    it("translates all 7 weekdays into the field's day options", () => {
      const view = prepareSiteSettingsFormData(undefined);

      assert.equal(view.workingHoursField.days.length, 7);
      assert.equal(view.workingHoursField.days[0].label, "Ponedeljak");
      assert.equal(view.workingHoursField.days[6].label, "Nedelja");
    });

    it("carries the stored 7-day schedule through as the field's value", () => {
      const workingHours = [
        { day: "monday", isOpen: true, from: "09:00", to: "17:00" },
        { day: "tuesday", isOpen: true, from: "09:00", to: "17:00" },
        { day: "wednesday", isOpen: false, from: "09:00", to: "20:00" },
        { day: "thursday", isOpen: true, from: "09:00", to: "17:00" },
        { day: "friday", isOpen: true, from: "09:00", to: "17:00" },
        { day: "saturday", isOpen: false, from: "09:00", to: "20:00" },
        { day: "sunday", isOpen: false, from: "09:00", to: "20:00" },
      ];
      const view = prepareSiteSettingsFormData({ workingHours });

      assert.deepEqual(view.workingHoursField.value, workingHours);
    });

    it("falls back to an all-closed 7-day default when nothing is stored yet", () => {
      const view = prepareSiteSettingsFormData(undefined);

      assert.equal(view.workingHoursField.value.length, 7);
      assert.equal(view.workingHoursField.value.every((wh) => wh.isOpen === false), true);
    });
  });

  describe("closedDatesField (neradni dani, own form)", () => {
    it("is kept out of the main `fields` array - it posts to its own route, not /admin/sajt", () => {
      const view = prepareSiteSettingsFormData(undefined);

      assert.equal(view.fields.some((f) => f.name === "closedDates"), false);
      assert.equal(view.closedDatesField.type, "repeater");
      assert.equal(view.closedDatesFormAction, "/admin/sajt/neradni-dani");
    });

    it("reuses the generic repeater's itemFields shape (date, reason, recurringYearly)", () => {
      const view = prepareSiteSettingsFormData(undefined);

      const names = view.closedDatesField.itemFields.map((f) => f.name);
      assert.deepEqual(names, ["date", "reason", "recurringYearly"]);
    });

    it("formats a stored Date instance as a plain YYYY-MM-DD string for the date input", () => {
      const view = prepareSiteSettingsFormData({
        closedDates: [{ date: new Date("2026-01-01T00:00:00.000Z"), reason: "Nova godina", recurringYearly: true }],
      });

      assert.deepEqual(view.closedDatesField.value, [{ date: "2026-01-01", reason: "Nova godina", recurringYearly: true }]);
    });

    it("defaults to an empty list when nothing is stored yet", () => {
      const view = prepareSiteSettingsFormData(undefined);

      assert.deepEqual(view.closedDatesField.value, []);
    });
  });
});