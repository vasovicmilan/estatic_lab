import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import BUSINESS, { DEFAULT_BUSINESS, resolveBusiness, applyBusinessSettings, toPhoneHref } from "../../../src/config/business.config.js";
import siteSettingsRepo from "../../../src/repositories/site-settings.repository.js";
import { loadRuntimeSettings, getShopPolicy } from "../../../src/config/runtime-settings.cache.js";

describe("business settings (admin-editable business identity)", () => {
  afterEach(() => applyBusinessSettings(null));

  it("resolveBusiness with nothing stored returns the code/env defaults", () => {
    assert.deepEqual(resolveBusiness(undefined), DEFAULT_BUSINESS);
  });

  it("overlays stored values and derives phoneHref and the full address", () => {
    const b = resolveBusiness({
      name: "Novi Salon",
      phone: "065 123 456",
      email: "info@example.rs",
      address: { streetAddress: "Bulevar 1", addressLocality: "Beograd", postalCode: "11000", addressCountry: "RS" },
      sameAs: ["https://instagram.com/x"],
      taxId: "",
    });
    assert.equal(b.name, "Novi Salon");
    assert.equal(b.phoneHref, "+38165123456");
    assert.equal(b.address.full, "Bulevar 1, 11000 Beograd, Republika Srbija");
    assert.deepEqual(b.sameAs, ["https://instagram.com/x"]);
    assert.equal(b.taxId, null); // cleared on purpose
    assert.equal(b.adminEmail, "info@example.rs"); // follows the edited contact email
    assert.equal(b.legalName, DEFAULT_BUSINESS.legalName); // untouched field keeps its default
  });

  it("applyBusinessSettings mutates the shared BUSINESS object in place", () => {
    const ref = BUSINESS;
    applyBusinessSettings({ name: "Live Name" });
    assert.equal(ref.name, "Live Name");
    applyBusinessSettings(null);
    assert.equal(ref.name, DEFAULT_BUSINESS.name);
  });

  it("toPhoneHref normalises local and international formats", () => {
    assert.equal(toPhoneHref("+381 65 977 4000"), "+381659774000");
    assert.equal(toPhoneHref("00381659774000"), "+381659774000");
    assert.equal(toPhoneHref("065 977 4000"), "+381659774000");
  });

  it("runtime cache applies stored business + shop policy on load", async (t) => {
    t.mock.method(siteSettingsRepo, "findOrCreateSiteSettings", async () => ({
      business: { name: "Cached Name", address: { streetAddress: "A 1", addressLocality: "NS" } },
      shopPolicy: { defaultShippingPrice: 777, orderCommissionGraceDays: 30 },
    }));
    await loadRuntimeSettings();
    assert.equal(BUSINESS.name, "Cached Name");
    assert.deepEqual(getShopPolicy(), { defaultShippingPrice: 777, orderCommissionGraceDays: 30 });
  });
});
