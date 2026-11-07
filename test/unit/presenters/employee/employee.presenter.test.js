import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareEmployeeDashboardData,
  prepareEmployeeAppointmentTabData,
  prepareEmployeeAppointmentDetailData,
  prepareEmployeeProfileTabData,
  prepareEmployeeCommissionsTabData,
  prepareEmployeePayoutsTabData,
} from "../../../../src/presenters/employee/employee.presenter.js";

describe("prepareEmployeeDashboardData", () => {
  it("returns a null balance for a salaried employee with no balance data", () => {
    const view = prepareEmployeeDashboardData({ isCommissionBased: false, balance: null });
    assert.equal(view.balance, null);
  });

  it("formats every balance figure with the currency suffix, and keeps a raw whole-number availableRaw for the withdrawal form", () => {
    const view = prepareEmployeeDashboardData({
      isCommissionBased: true,
      balance: { earned: 5000.5, paid: 2000, reserved: 500, available: 2500.5 },
    });

    assert.equal(view.balance.earned, "5001 RSD");
    assert.equal(view.balance.available, "2501 RSD");
    assert.equal(view.balance.availableRaw, 2501);
  });

  it("translates each recent commission entry's source type and status", () => {
    const view = prepareEmployeeDashboardData({
      recentCommissions: [{ id: "c1", sourceType: "appointment", baseValue: 4000, rate: 20, amount: 800, status: "earned" }],
    });

    assert.equal(view.recentCommissions[0].izvor, "Termin");
    assert.equal(view.recentCommissions[0].status, "Zarađeno");
    assert.equal(view.recentCommissions[0].procenat, "20%");
  });

  it("defaults all collections to empty when nothing is passed", () => {
    const view = prepareEmployeeDashboardData();
    assert.deepEqual(view.todayAppointments, []);
    assert.deepEqual(view.weekAppointments, []);
    assert.deepEqual(view.recentCommissions, []);
    assert.equal(view.pendingCount, 0);
  });
});

describe("prepareEmployeeAppointmentTabData", () => {
  const list = (data, page = 1, totalPages = 1, total = data.length) => ({ data, page, totalPages, total, limit: 10 });
  const inHours = (h) => new Date(Date.now() + h * 3600 * 1000);

  it("splits into Danas / Predstojeći / Prošli with a separate pager (and page-size options) for upcoming and past", () => {
    const upcoming = list([{ id: "later", startTimeRaw: inHours(24 * 5) }], 1, 3, 25);
    const past = list([{ id: "old", startTimeRaw: inHours(-24 * 5) }], 2, 4, 40);
    const view = prepareEmployeeAppointmentTabData({ upcoming, past }, { status: "confirmed", limit: "20" });

    assert.deepEqual(view.groups.predstojeci.map((a) => a.id), ["later"]);
    assert.deepEqual(view.groups.prosli.map((a) => a.id), ["old"]);
    assert.equal(view.paginationUpcoming.pageParam, "upcomingPage");
    assert.equal(view.paginationPast.pageParam, "pastPage");
    assert.equal(view.paginationPast.currentPage, 2);
    assert.ok(view.paginationUpcoming.pageSizeOptions.includes(20));
    assert.equal(view.selectedStatus, "confirmed");
    // paging one section must not lose the status, the page size, or the other section's page
    assert.equal(view.paginationUpcoming.query.limit, "20");
    assert.equal(view.paginationUpcoming.query.status, "confirmed");
  });

  it("offers a narrower status filter set than the admin panel - no reject/cancel, an employee can't do those", () => {
    const view = prepareEmployeeAppointmentTabData({ upcoming: list([]), past: list([]) });
    const values = view.filters.map((f) => f.value);

    assert.deepEqual(values, ["", "pending", "confirmed", "completed", "no_show"]);
  });
});

describe("prepareEmployeeAppointmentDetailData - real getRescheduleWindow", () => {
  it("allows confirm/reject only while pending, complete/no-show only once confirmed", () => {
    const pending = prepareEmployeeAppointmentDetailData({ id: "a1", status: "Na čekanju", statusRaw: "pending", termin: {} });
    const confirmed = prepareEmployeeAppointmentDetailData({ id: "a1", status: "Potvrđeno", statusRaw: "confirmed", termin: {} });

    assert.equal(pending.canConfirm, true);
    assert.equal(pending.canReject, true);
    assert.equal(pending.canComplete, false);

    assert.equal(confirmed.canComplete, true);
    assert.equal(confirmed.canNoShow, true);
    assert.equal(confirmed.canConfirm, false);
  });

  it("forbids rescheduling a completed appointment entirely - not just hides the button, blocks it at the data level", () => {
    const view = prepareEmployeeAppointmentDetailData({
      id: "a1",
      status: "Završeno",
      statusRaw: "completed",
      termin: { pocetakRaw: new Date(Date.now() + 86400000) },
    });
    assert.equal(view.canReschedule, false);
    assert.equal(view.rescheduleWindow, "forbidden");
  });

  it("allows rescheduling to any day when the appointment is comfortably far in the future", () => {
    const farFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const view = prepareEmployeeAppointmentDetailData({ id: "a1", status: "Na čekanju", statusRaw: "pending", termin: { pocetakRaw: farFuture } });

    assert.equal(view.canReschedule, true);
    assert.equal(view.rescheduleWindow, "any_day");
  });

  it("embeds the appointment's own id into the reschedule action URL", () => {
    const view = prepareEmployeeAppointmentDetailData({ id: "apt-42", status: "Na čekanju", statusRaw: "pending", termin: {} });
    assert.equal(view.rescheduleActionUrl, "/moj-nalog/termini/apt-42/pomeri");
  });
});

describe("prepareEmployeeProfileTabData", () => {
  it("includes all 7 weekdays as schedule day options, in order", () => {
    const view = prepareEmployeeProfileTabData({ id: "e1" });
    assert.equal(view.scheduleDays.length, 7);
    assert.equal(view.scheduleDays[0].value, "monday");
    assert.equal(view.scheduleDays[6].value, "sunday");
  });
});

describe("prepareEmployeeCommissionsTabData", () => {
  it("offers both a status filter and a source-type filter", () => {
    const view = prepareEmployeeCommissionsTabData({ data: [], page: 1, totalPages: 1 });

    assert.deepEqual(
      view.filters.status.options.map((o) => o.value),
      ["", "pending", "earned", "reversed"]
    );
    assert.deepEqual(
      view.filters.sourceType.options.map((o) => o.value),
      ["", "appointment", "order", "package_purchase"]
    );
  });

  it("maps each commission entry through the same translation used on the dashboard", () => {
    const result = { data: [{ id: "c1", sourceType: "order", baseValue: 10000, rate: 5, amount: 500, status: "pending" }], page: 1, totalPages: 1 };
    const view = prepareEmployeeCommissionsTabData(result);

    assert.equal(view.items[0].izvor, "Porudžbina");
    assert.equal(view.items[0].status, "Na čekanju");
  });
});

describe("prepareEmployeePayoutsTabData - mapPayoutRequestRow's 'azurirano' fallback chain", () => {
  it("prefers paidAt over rejectedAt/approvedAt/requestedAt", () => {
    const view = prepareEmployeePayoutsTabData({
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

    assert.notEqual(view.items[0].azurirano, view.items[0].zatrazeno);
  });

  it("falls back to requestedAt when nothing else has happened yet", () => {
    const requestedAt = new Date("2026-01-01T10:00:00Z");
    const view = prepareEmployeePayoutsTabData({
      data: [{ amount: 1000, status: "requested", requestedAt, approvedAt: null, paidAt: null, rejectedAt: null }],
      page: 1,
      totalPages: 1,
    });

    assert.equal(view.items[0].azurirano, view.items[0].zatrazeno);
  });

  it("offers all 4 payout statuses as filter options", () => {
    const view = prepareEmployeePayoutsTabData({ data: [], page: 1, totalPages: 1 });
    assert.deepEqual(
      view.filters.status.options.map((o) => o.value),
      ["", "requested", "approved", "paid", "rejected"]
    );
  });
});