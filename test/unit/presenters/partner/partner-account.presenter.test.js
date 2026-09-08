import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preparePartnerDashboardData,
  preparePartnerPayoutsTabData,
  preparePartnerCommissionsTabData,
  preparePayoutRequestFormData,
} from "../../../../src/presenters/partner/partner-account.presenter.js";

describe("preparePartnerDashboardData", () => {
  // matches coupon.service.js's listCouponsForPartner output shape - every
  // field it now returns, defaulted to the "unrestricted, unlimited" case so
  // each test below only needs to override what it's actually testing.
  function buildTestCoupon(overrides = {}) {
    return {
      code: "TEST10",
      discountType: "percentage",
      discountValue: 10,
      applicableServices: [],
      applicablePackages: [],
      productDiscount: null,
      validUntil: null,
      maxUses: null,
      usedCount: 0,
      ...overrides,
    };
  }

  it("formats every balance figure with the currency suffix, and keeps a raw whole-number availableRaw for the withdrawal form", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 5000.5, paid: 2000, reserved: 500, available: 2500.5 },
      coupons: [],
      recentCommissions: [],
    });

    assert.equal(view.balance.earned, "5001 RSD");
    assert.equal(view.balance.available, "2501 RSD");
    assert.equal(view.balance.availableRaw, 2501);
  });

  it("builds a referral link per coupon, describing a percentage discount distinctly from a fixed one", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [
        buildTestCoupon({ code: "PETAR10", discountType: "percentage", discountValue: 10 }),
        buildTestCoupon({ code: "PETARFIX", discountType: "fixed", discountValue: 500 }),
      ],
      recentCommissions: [],
    });

    assert.match(view.referralLinks[0].uslugeOpis, /10%/);
    assert.match(view.referralLinks[1].uslugeOpis, /500 RSD/);
  });

  it("only includes an artikli description when the coupon actually has a productDiscount", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [
        buildTestCoupon({ code: "SAMOUSLUGE", productDiscount: null }),
        buildTestCoupon({ code: "IARTIKLI", productDiscount: { discountType: "fixed", discountValue: 300 } }),
      ],
      recentCommissions: [],
    });

    assert.equal(view.referralLinks[0].artikliOpis, null, "no productDiscount on the coupon -> no artikli line at all");
    assert.match(view.referralLinks[1].artikliOpis, /300 RSD/);
  });

  it("describes the coupon's scope - 'applies to everything' when unrestricted, named services/packages when it isn't", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [
        buildTestCoupon({ code: "SVE", applicableServices: [], applicablePackages: [] }),
        buildTestCoupon({ code: "SAMO_S1", applicableServices: ["s1"], applicablePackages: [] }),
      ],
      serviceNamesById: { s1: "Tesla-Tone 24" },
      packageNamesById: {},
      recentCommissions: [],
    });

    assert.match(view.referralLinks[0].opseg, /sve usluge i pakete/);
    assert.match(view.referralLinks[1].opseg, /Tesla-Tone 24/);
  });

  it("shows 'Važi do' only when the coupon actually has an expiration, but always shows a usage count (unlimited or capped)", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [
        buildTestCoupon({ code: "BEZOGRANICENJA", validUntil: null, maxUses: null, usedCount: 7 }),
        buildTestCoupon({ code: "OGRANICENO", validUntil: new Date("2026-12-31"), maxUses: 50, usedCount: 12 }),
      ],
      recentCommissions: [],
    });

    assert.equal(view.referralLinks[0].vaziDo, null);
    assert.equal(view.referralLinks[0].iskorisceno, "7 puta", "no maxUses cap - still shows how many times it's been used");
    assert.ok(view.referralLinks[1].vaziDo);
    assert.equal(view.referralLinks[1].iskorisceno, "12 / 50");
  });

  it("URL-encodes the coupon code into the referral link", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [buildTestCoupon({ code: "PETAR & CO", discountType: "fixed", discountValue: 100 })],
      recentCommissions: [],
    });

    assert.match(view.referralLinks[0].link, /^https?:\/\/.+\/\?code=PETAR%20%26%20CO$/);
  });

  it("handles multiple coupons independently - a partner isn't assumed to have exactly one", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [
        buildTestCoupon({ code: "A", discountType: "fixed", discountValue: 100 }),
        buildTestCoupon({ code: "B", discountType: "fixed", discountValue: 200 }),
      ],
      recentCommissions: [],
    });

    assert.equal(view.referralLinks.length, 2);
  });

  it("translates each recent commission's source type and status", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [],
      recentCommissions: [{ id: "c1", sourceType: "order", baseValue: 10000, rate: 5, amount: 500, status: "earned", earnedAt: new Date() }],
    });

    assert.equal(view.recentCommissions[0].izvor, "Porudžbina");
    assert.equal(view.recentCommissions[0].status, "Zarađeno");
  });

  it("defaults payoutRequests to an empty mapped list when none are passed", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [],
      recentCommissions: [],
    });

    assert.deepEqual(view.payoutRequests, []);
  });

  it("maps a payout request's status to Serbian and preserves the raw status separately", () => {
    const view = preparePartnerDashboardData({
      partner: { id: "p1" },
      balance: { earned: 0, paid: 0, reserved: 0, available: 0 },
      coupons: [],
      recentCommissions: [],
      payoutRequests: [{ amount: 2000, status: "approved", adminNote: null, requestedAt: new Date(), approvedAt: new Date() }],
    });

    assert.equal(view.payoutRequests[0].status, "Odobreno");
    assert.equal(view.payoutRequests[0].statusRaw, "approved");
  });
});

describe("mapPayoutRequestRow's 'azurirano' fallback chain", () => {
  it("prefers paidAt over rejectedAt/approvedAt/requestedAt when the request was actually paid", () => {
    const view = preparePartnerPayoutsTabData({
      data: [
        {
          amount: 1000,
          status: "paid",
          requestedAt: new Date("2026-01-01"),
          approvedAt: new Date("2026-01-02"),
          paidAt: new Date("2026-01-03"),
          rejectedAt: null,
        },
      ],
      page: 1,
      totalPages: 1,
    });

    // formatDateTime renders a real date string - just confirm it's not the
    // requestedAt date being shown instead
    assert.notEqual(view.items[0].azurirano, view.items[0].zatrazeno);
  });

  it("falls back to requestedAt when nothing else has happened yet", () => {
    const requestedAt = new Date("2026-01-01T10:00:00Z");
    const view = preparePartnerPayoutsTabData({
      data: [{ amount: 1000, status: "requested", requestedAt, approvedAt: null, paidAt: null, rejectedAt: null }],
      page: 1,
      totalPages: 1,
    });

    assert.equal(view.items[0].azurirano, view.items[0].zatrazeno);
  });
});

describe("preparePartnerPayoutsTabData", () => {
  it("offers all four payout statuses as filter options", () => {
    const view = preparePartnerPayoutsTabData({ data: [], page: 1, totalPages: 1 });
    const values = view.filters.status.options.map((o) => o.value);

    assert.deepEqual(values, ["", "requested", "approved", "paid", "rejected"]);
  });
});

describe("preparePartnerCommissionsTabData", () => {
  it("offers both a status filter and a source-type filter", () => {
    const view = preparePartnerCommissionsTabData({ data: [], page: 1, totalPages: 1 });

    assert.deepEqual(
      view.filters.status.options.map((o) => o.value),
      ["", "pending", "earned", "reversed"]
    );
    assert.deepEqual(
      view.filters.sourceType.options.map((o) => o.value),
      ["", "appointment", "package_purchase", "order"]
    );
  });

  it("maps each commission row through the same translation as the dashboard view", () => {
    const result = { data: [{ id: "c1", sourceType: "appointment", baseValue: 4000, rate: 20, amount: 800, status: "pending" }], page: 1, totalPages: 1 };
    const view = preparePartnerCommissionsTabData(result);

    assert.equal(view.items[0].izvor, "Termin");
    assert.equal(view.items[0].procenat, "20%");
    assert.equal(view.items[0].iznos, "800 RSD");
  });
});

describe("preparePayoutRequestFormData", () => {
  it("exposes the available balance and posts to the partner's own payout endpoint", () => {
    const view = preparePayoutRequestFormData({ earned: 5000, paid: 0, reserved: 0, available: 5000 });

    assert.equal(view.available, 5000);
    assert.equal(view.formAction, "/moj-partner-nalog/isplata");
  });
});