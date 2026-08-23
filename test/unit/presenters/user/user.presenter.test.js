import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareProfileTabData,
  prepareAppointmentTabData,
  prepareAppointmentDetailData,
  prepareSettingsTabData,
  prepareOrdersTabData,
  prepareOrderDetailData,
  prepareAddressesTabData,
  prepareCartTabData,
} from "../../../../src/presenters/user/user.presenter.js";

describe("prepareProfileTabData", () => {
  it("passes the user through and points editUrl at the settings tab", () => {
    const user = { id: "u1", firstName: "Petar" };
    const view = prepareProfileTabData(user);

    assert.equal(view.user, user);
    assert.equal(view.editUrl, "/nalog/podesavanja");
  });
});

describe("prepareAppointmentTabData", () => {
  it("offers a narrower status filter set than admin - only the customer-relevant statuses", () => {
    const view = prepareAppointmentTabData({ data: [], page: 1, totalPages: 1 });
    assert.deepEqual(
      view.filters.map((f) => f.value),
      ["", "pending", "confirmed", "completed", "cancelled"]
    );
  });
});

describe("prepareAppointmentDetailData - real 24h cancellation cutoff", () => {
  it("allows cancelling a confirmed appointment comfortably more than 24h out", () => {
    const farFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const view = prepareAppointmentDetailData({ id: "a1", statusRaw: "confirmed", termin: { pocetakRaw: farFuture } });

    assert.equal(view.canCancel, true);
  });

  it("refuses to cancel an appointment inside the 24h window", () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const view = prepareAppointmentDetailData({ id: "a1", statusRaw: "confirmed", termin: { pocetakRaw: soon } });

    assert.equal(view.canCancel, false);
  });

  it("refuses to cancel an already-completed appointment regardless of timing", () => {
    const farFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const view = prepareAppointmentDetailData({ id: "a1", statusRaw: "completed", termin: { pocetakRaw: farFuture } });

    assert.equal(view.canCancel, false);
  });

  it("embeds the appointment's own id into the reschedule action URL", () => {
    const view = prepareAppointmentDetailData({ id: "apt-99", statusRaw: "pending", termin: {} });
    assert.equal(view.rescheduleActionUrl, "/nalog/termini/apt-99/pomeri");
  });
});

describe("prepareSettingsTabData", () => {
  it("re-shows the submitted name/phone but never exposes email/password fields", () => {
    const view = prepareSettingsTabData({ firstName: "Petar", lastName: "Petrovic", telefon: "0601234567" });

    assert.equal(view.formData.firstName, "Petar");
    assert.equal(view.formData.phone, "0601234567");
    assert.ok(!("email" in view.formData));
    assert.ok(!("password" in view.formData));
  });

  it("points to separate password-change and account-deactivation actions", () => {
    const view = prepareSettingsTabData({ firstName: "Petar", lastName: "Petrovic" });
    assert.equal(view.changePasswordUrl, "/nalog/promena-lozinke");
    assert.equal(view.deactivateUrl, "/nalog/deaktivacija");
  });
});

describe("prepareOrdersTabData", () => {
  it("offers all 7 order statuses as filter options", () => {
    const view = prepareOrdersTabData({ data: [], page: 1, totalPages: 1 });
    assert.equal(view.filters.length, 7);
  });
});

describe("prepareOrderDetailData - real canUserCancelOrder", () => {
  it("allows cancelling a 'pending' order", () => {
    const view = prepareOrderDetailData({ id: "o1", statusRaw: "pending" });
    assert.equal(view.canCancel, true);
  });

  it("refuses to cancel an order that's already moved past 'pending'", () => {
    const view = prepareOrderDetailData({ id: "o1", statusRaw: "processing" });
    assert.equal(view.canCancel, false);
  });
});

describe("prepareAddressesTabData", () => {
  it("defaults to an empty address list", () => {
    const view = prepareAddressesTabData();
    assert.deepEqual(view.addresses, []);
  });
});

describe("prepareCartTabData", () => {
  it("points checkoutUrl at the real checkout route", () => {
    const view = prepareCartTabData({ stavke: [] });
    assert.equal(view.checkoutUrl, "/korpa/naplata");
  });
});