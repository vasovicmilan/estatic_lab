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
  function result(data, overrides = {}) {
    return { data, page: 1, totalPages: 1, ...overrides };
  }
  const emptyResult = result([]);

  it("offers a narrower status filter set than admin - only the customer-relevant statuses", () => {
    const view = prepareAppointmentTabData({ upcoming: emptyResult, past: emptyResult });
    assert.deepEqual(
      view.filters.map((f) => f.value),
      ["", "pending", "confirmed", "completed", "cancelled"]
    );
  });

  it("surfaces the active status filter so the dropdown can show <option selected> - the fix for the 'stuck filtered, can't get back to Svi' bug", () => {
    const view = prepareAppointmentTabData({ upcoming: emptyResult, past: emptyResult }, { status: "confirmed" });
    assert.equal(view.selectedStatus, "confirmed");
  });

  it("defaults selectedStatus to '' (matching the 'Svi' option) when no status query param is present", () => {
    const view = prepareAppointmentTabData({ upcoming: emptyResult, past: emptyResult }, {});
    assert.equal(view.selectedStatus, "");
  });

  describe("upcoming/past are queried and paginated separately - the fix for a same-day cluster splitting across pages", () => {
    it("exposes upcoming's own page/totalPages under paginationUpcoming, with its own pageParam", () => {
      const view = prepareAppointmentTabData({ upcoming: result([], { page: 2, totalPages: 5 }), past: emptyResult });
      assert.equal(view.paginationUpcoming.currentPage, 2);
      assert.equal(view.paginationUpcoming.totalPages, 5);
      assert.equal(view.paginationUpcoming.pageParam, "upcomingPage");
    });

    it("exposes past's own page/totalPages under paginationPast, with its own pageParam", () => {
      const view = prepareAppointmentTabData({ upcoming: emptyResult, past: result([], { page: 3, totalPages: 7 }) });
      assert.equal(view.paginationPast.currentPage, 3);
      assert.equal(view.paginationPast.totalPages, 7);
      assert.equal(view.paginationPast.pageParam, "pastPage");
    });

    it("carries the OTHER section's current page through each pagination's query, so paging one never resets the other", () => {
      const view = prepareAppointmentTabData({ upcoming: emptyResult, past: emptyResult }, { upcomingPage: "4", pastPage: "2" });
      assert.equal(view.paginationUpcoming.query.pastPage, "2");
      assert.equal(view.paginationPast.query.upcomingPage, "4");
    });

    it("carries the active status filter through both paginations' query", () => {
      const view = prepareAppointmentTabData({ upcoming: emptyResult, past: emptyResult }, { status: "completed" });
      assert.equal(view.paginationUpcoming.query.status, "completed");
      assert.equal(view.paginationPast.query.status, "completed");
    });
  });

  describe("groups - Danas/Predstojeći come from the 'upcoming' query, Prošli from the separate 'past' query", () => {
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    it("puts a mid-afternoon-today appointment in 'danas', not 'predstojeci'", () => {
      // noon UTC is always the same calendar day in Belgrade (UTC+1/+2) regardless of DST
      const todayNoon = new Date();
      todayNoon.setUTCHours(12, 0, 0, 0);

      const view = prepareAppointmentTabData({ upcoming: result([{ id: "a1", startTimeRaw: todayNoon }]), past: emptyResult });

      assert.equal(view.groups.danas.length, 1);
      assert.equal(view.groups.predstojeci.length, 0);
    });

    it("puts a week-from-now appointment in 'predstojeci'", () => {
      const nextWeek = new Date(Date.now() + 7 * DAY);
      const view = prepareAppointmentTabData({ upcoming: result([{ id: "a1", startTimeRaw: nextWeek }]), past: emptyResult });

      assert.equal(view.groups.predstojeci.length, 1);
      assert.equal(view.groups.danas.length, 0);
    });

    it("takes 'prosli' directly from the past query's own data, already sorted most-recent-first by the repo", () => {
      const recent = new Date(Date.now() - 2 * DAY);
      const old = new Date(Date.now() - 20 * DAY);
      const view = prepareAppointmentTabData({
        upcoming: emptyResult,
        past: result([{ id: "recent", startTimeRaw: recent }, { id: "old", startTimeRaw: old }]),
      });

      assert.deepEqual(
        view.groups.prosli.map((a) => a.id),
        ["recent", "old"]
      );
    });

    it("splits the 'upcoming' query's own data into danas/predstojeci correctly, independent of 'prosli'", () => {
      const todayNoon = new Date();
      todayNoon.setUTCHours(12, 0, 0, 0);
      const future = new Date(Date.now() + 5 * DAY);
      const past = new Date(Date.now() - 5 * DAY);

      const view = prepareAppointmentTabData({
        upcoming: result([{ id: "f", startTimeRaw: future }, { id: "t", startTimeRaw: todayNoon }]),
        past: result([{ id: "p", startTimeRaw: past }]),
      });

      assert.equal(view.groups.danas.length, 1);
      assert.equal(view.groups.predstojeci.length, 1);
      assert.equal(view.groups.prosli.length, 1);
    });

    it("concatenates upcoming+past into `appointments` for the empty-state check, without re-sorting them together", () => {
      const view = prepareAppointmentTabData({
        upcoming: result([{ id: "u1" }]),
        past: result([{ id: "p1" }]),
      });
      assert.equal(view.appointments.length, 2);
    });
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