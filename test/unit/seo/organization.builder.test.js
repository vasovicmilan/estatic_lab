import { describe, it } from "node:test";
import assert from "node:assert/strict";
import employeeService from "../../../src/services/employee.service.js";
import runtimeSettingsCache from "../../../src/config/runtime-settings.cache.js";
import { buildOrganizationJsonLd } from "../../../src/seo/organization.builder.js";

function fakeReq({ protocol = "https", host = "beautymedica.rs" } = {}) {
  return { protocol, get: (header) => (header === "host" ? host : null) };
}

describe("seo/organization.builder", () => {
  it("always includes the core business fields (name, address, geo, phone)", async (t) => {
    t.mock.method(employeeService, "getAggregateBusinessHours", async () => []);
    const result = await buildOrganizationJsonLd(fakeReq());

    assert.equal(result["@type"], "HealthAndBeautyBusiness");
    assert.equal(result.telephone, "+381 65 977 4000");
    assert.equal(result.address.addressLocality, "Novi Sad");
    assert.equal(result.geo.latitude, 45.24961274772971);
  });

  it("includes sameAs since real social profiles are configured", async (t) => {
    t.mock.method(employeeService, "getAggregateBusinessHours", async () => []);
    const result = await buildOrganizationJsonLd(fakeReq());
    assert.ok(Array.isArray(result.sameAs));
    assert.ok(result.sameAs.some((url) => url.includes("instagram.com")));
  });

  it("includes openingHoursSpecification built from the aggregate hours when hours exist", async (t) => {
    t.mock.method(employeeService, "getAggregateBusinessHours", async () => [
      { dayOfWeek: "Monday", opens: "09:00", closes: "20:00" },
    ]);
    const result = await buildOrganizationJsonLd(fakeReq());

    assert.equal(result.openingHoursSpecification.length, 1);
    assert.equal(result.openingHoursSpecification[0]["@type"], "OpeningHoursSpecification");
    assert.equal(result.openingHoursSpecification[0].dayOfWeek, "Monday");
    assert.equal(result.openingHoursSpecification[0].opens, "09:00");
  });

  it("omits openingHoursSpecification entirely when no employee schedule exists yet, rather than an empty array", async (t) => {
    t.mock.method(employeeService, "getAggregateBusinessHours", async () => []);
    t.mock.method(runtimeSettingsCache, "hasFixedWorkingHours", () => false);
    const result = await buildOrganizationJsonLd(fakeReq());
    assert.equal("openingHoursSpecification" in result, false);
  });

  it("prefers the admin-configured fixed site-settings schedule over the derived employee-aggregate hours once one is set", async (t) => {
    const aggregateMock = t.mock.fn(async () => [{ dayOfWeek: "Monday", opens: "08:00", closes: "16:00" }]);
    t.mock.method(employeeService, "getAggregateBusinessHours", aggregateMock);
    t.mock.method(runtimeSettingsCache, "hasFixedWorkingHours", () => true);
    t.mock.method(runtimeSettingsCache, "getWorkingHours", () => [
      { day: "monday", isOpen: true, from: "09:00", to: "20:00" },
      { day: "tuesday", isOpen: true, from: "09:00", to: "20:00" },
      { day: "sunday", isOpen: false, from: "09:00", to: "20:00" },
    ]);

    const result = await buildOrganizationJsonLd(fakeReq());

    assert.equal(aggregateMock.mock.calls.length, 0, "must not even call the derived aggregate once a fixed schedule exists");
    assert.equal(result.openingHoursSpecification.length, 2);
    assert.deepEqual(result.openingHoursSpecification[0], { "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "09:00", closes: "20:00" });
  });

  it("falls back to the derived employee-aggregate hours while the fixed schedule is still unconfigured (every day isOpen: false)", async (t) => {
    t.mock.method(employeeService, "getAggregateBusinessHours", async () => [{ dayOfWeek: "Monday", opens: "08:00", closes: "16:00" }]);
    t.mock.method(runtimeSettingsCache, "hasFixedWorkingHours", () => false);

    const result = await buildOrganizationJsonLd(fakeReq());

    assert.equal(result.openingHoursSpecification.length, 1);
    assert.equal(result.openingHoursSpecification[0].opens, "08:00");
  });
});