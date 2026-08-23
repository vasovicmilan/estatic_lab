import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareBookingServiceStepData,
  prepareBookingSlotsStepData,
  prepareBookingContactStepData,
  prepareBookingConfirmationData,
} from "../../../../src/presenters/public/booking.presenter.js";

describe("prepareBookingServiceStepData", () => {
  it("points nextUrl at this specific service's slot-selection step", () => {
    const view = prepareBookingServiceStepData({ slug: "masaza-opustajuca", naziv: "Masaza opustajuca" });
    assert.equal(view.nextUrl, "/zakazivanje/masaza-opustajuca/termin");
  });

  it("is step 1 of the flow", () => {
    const view = prepareBookingServiceStepData({ slug: "masaza", naziv: "Masaza" });
    assert.equal(view.step, 1);
  });
});

describe("prepareBookingSlotsStepData - real Belgrade AM/PM split", () => {
  it("classifies a slot well before noon Belgrade time as 'am'", () => {
    // 03:00 UTC is before noon Belgrade regardless of DST (UTC+1 or UTC+2)
    const slots = [{ startTime: "2026-01-15T03:00:00Z", endTime: "2026-01-15T03:30:00Z" }];
    const view = prepareBookingSlotsStepData({ slug: "masaza", naziv: "Masaza" }, {}, { slots });

    assert.equal(view.slots[0].period, "am");
  });

  it("classifies a slot well after noon Belgrade time as 'pm'", () => {
    // 15:00 UTC is after noon Belgrade regardless of DST
    const slots = [{ startTime: "2026-01-15T15:00:00Z", endTime: "2026-01-15T15:30:00Z" }];
    const view = prepareBookingSlotsStepData({ slug: "masaza", naziv: "Masaza" }, {}, { slots });

    assert.equal(view.slots[0].period, "pm");
  });

  it("carries the employeeId through for a resource-specific slot, null for an 'any employee' one", () => {
    const slots = [
      { startTime: "2026-01-15T03:00:00Z", endTime: "2026-01-15T03:30:00Z", employeeId: "emp-1" },
      { startTime: "2026-01-15T04:00:00Z", endTime: "2026-01-15T04:30:00Z" },
    ];
    const view = prepareBookingSlotsStepData({ slug: "masaza", naziv: "Masaza" }, {}, { slots });

    assert.equal(view.slots[0].terapeutId, "emp-1");
    assert.equal(view.slots[1].terapeutId, null);
  });

  it("is step 2 of the flow", () => {
    const view = prepareBookingSlotsStepData({ slug: "masaza", naziv: "Masaza" }, {});
    assert.equal(view.step, 2);
  });
});

describe("prepareBookingContactStepData", () => {
  it("prefills contact info from the logged-in user's profile", () => {
    const view = prepareBookingContactStepData(
      { slug: "masaza", naziv: "Masaza" },
      { id: "v1", cena: "3000 RSD" },
      { startTime: "2026-01-15T10:00:00Z" },
      { isLoggedIn: true, user: { firstName: "Petar", lastName: "Petrovic", email: "petar@example.com", telefon: "0601234567" } }
    );

    assert.equal(view.prefill.firstName, "Petar");
    assert.equal(view.prefill.phone, "0601234567");
  });

  it("leaves all prefill fields blank for a guest", () => {
    const view = prepareBookingContactStepData({ slug: "masaza", naziv: "Masaza" }, { id: "v1", cena: "3000 RSD" }, { startTime: "2026-01-15T10:00:00Z" });
    assert.equal(view.prefill.firstName, "");
  });

  it("strips a formatted price string down to a plain number for the coupon widget", () => {
    const view = prepareBookingContactStepData({ slug: "masaza", naziv: "Masaza" }, { id: "v1", cena: "3.000 RSD" }, { startTime: "2026-01-15T10:00:00Z" });
    assert.equal(view.appointmentValue, 3000);
  });

  it("returns 0 for an unparseable price rather than NaN", () => {
    const view = prepareBookingContactStepData({ slug: "masaza", naziv: "Masaza" }, { id: "v1", cena: null }, { startTime: "2026-01-15T10:00:00Z" });
    assert.equal(view.appointmentValue, 0);
  });

  it("returns null usablePackagePurchase when the customer has no package covering this exact variant", () => {
    const view = prepareBookingContactStepData({ slug: "masaza", naziv: "Masaza" }, { id: "v1", cena: "3000 RSD" }, { startTime: "2026-01-15T10:00:00Z" });
    assert.equal(view.usablePackagePurchase, null);
  });

  it("computes the remaining sessions as total - used - reserved for the matching package item", () => {
    const usablePackagePurchase = {
      _id: "pp1",
      items: [{ servicePackageId: "v1", sessionsTotal: 5, sessionsUsed: 2, sessionsReserved: 1 }],
    };
    const view = prepareBookingContactStepData(
      { slug: "masaza", naziv: "Masaza" },
      { id: "v1", cena: "3000 RSD" },
      { startTime: "2026-01-15T10:00:00Z" },
      { usablePackagePurchase }
    );

    assert.equal(view.usablePackagePurchase.preostaloSeansi, 2);
  });

  it("is step 3 of the flow", () => {
    const view = prepareBookingContactStepData({ slug: "masaza", naziv: "Masaza" }, { id: "v1", cena: "0" }, { startTime: "2026-01-15T10:00:00Z" });
    assert.equal(view.step, 3);
  });
});

describe("prepareBookingConfirmationData", () => {
  it("defaults accountJustCreated to false", () => {
    const view = prepareBookingConfirmationData({ id: "apt-1" });
    assert.equal(view.accountJustCreated, false);
  });

  it("flags accountJustCreated when a guest booking created a new account", () => {
    const view = prepareBookingConfirmationData({ id: "apt-1" }, { accountJustCreated: true });
    assert.equal(view.accountJustCreated, true);
  });
});