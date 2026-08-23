import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareAuditLogListData } from "../../../../../src/presenters/admin/logs/audit-log.presenter.js";

// Unlike other presenters, this one maps RAW audit log entries itself
// (mapAuditLogRow is internal, not a separate mapper module) - so the input here
// mirrors the raw AuditLog document shape, not an already-mapped one.
function buildRawEntry(overrides = {}) {
  return {
    _id: "log-1",
    timestamp: new Date("2026-01-01T10:00:00Z"),
    actor: { email: "admin@example.com", role: "admin" },
    action: "PARTNER_CREATED",
    entity: { type: "Partner", id: "partner-1" },
    changes: null,
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

describe("prepareAuditLogListData", () => {
  it("maps the actor's email and role onto the row", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry()], page: 1, totalPages: 1 });
    assert.equal(view.items[0].korisnik, "admin@example.com");
    assert.equal(view.items[0].rola, "admin");
  });

  it("shows 'Sistem' when an entry has no actor - a system-triggered action", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry({ actor: null })], page: 1, totalPages: 1 });
    assert.equal(view.items[0].korisnik, "Sistem");
    assert.equal(view.items[0].rola, "-");
  });

  it("translates a known entity type into its Serbian label, with the entity id", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry({ entity: { type: "Partner", id: "p1" } })], page: 1, totalPages: 1 });
    assert.equal(view.items[0].entitet, "Partner #p1");
  });

  it("falls back to the raw entity type string for a type not in the translation map", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry({ entity: { type: "SomeNewModel", id: "x1" } })], page: 1, totalPages: 1 });
    assert.equal(view.items[0].entitet, "SomeNewModel #x1");
  });

  it("shows '-' for entitet when the log entry has no entity at all", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry({ entity: null })], page: 1, totalPages: 1 });
    assert.equal(view.items[0].entitet, "-");
  });

  it("formats a null changes object as null - no before/after trail to show", () => {
    const view = prepareAuditLogListData({ data: [buildRawEntry({ changes: null })], page: 1, totalPages: 1 });
    assert.equal(view.items[0].izmene, null);
  });

  it("renders each changed field as its own 'field: old -> new' line", () => {
    const view = prepareAuditLogListData({
      data: [buildRawEntry({ changes: { commissionRateServices: { old: 10, new: 15 }, isActive: { old: true, new: false } } })],
      page: 1,
      totalPages: 1,
    });

    const lines = view.items[0].izmene.split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /commissionRateServices: 10 → 15/);
    assert.match(lines[1], /isActive: true → false/);
  });

  it("shows 'Da'/'Ne' for success/failure, and surfaces the error message on a failed entry", () => {
    const success = prepareAuditLogListData({ data: [buildRawEntry({ success: true })], page: 1, totalPages: 1 });
    const failure = prepareAuditLogListData(
      { data: [buildRawEntry({ success: false, errorMessage: "Validacija nije uspela" })], page: 1, totalPages: 1 }
    );

    assert.equal(success.items[0].uspesno, "Da");
    assert.equal(failure.items[0].uspesno, "Ne");
    assert.equal(failure.items[0].greska, "Validacija nije uspela");
  });

  it("builds the action filter's options from the available-actions list passed in, plus an 'all' option", () => {
    const view = prepareAuditLogListData({ data: [], page: 1, totalPages: 1 }, {}, ["PARTNER_CREATED", "ORDER_CANCELLED"]);
    const values = view.filters.action.options.map((o) => o.value);

    assert.deepEqual(values, ["", "PARTNER_CREATED", "ORDER_CANCELLED"]);
  });

  it("preselects filter values from the query, defaulting sort order to 'desc'", () => {
    const view = prepareAuditLogListData({ data: [], page: 1, totalPages: 1 }, { actorRole: "partner", success: "false" });

    assert.equal(view.filters.actorRole.value, "partner");
    assert.equal(view.filters.success.value, "false");
    assert.equal(view.filters.sortOrder.value, "desc");
  });

  it("respects an explicit 'asc' sort order from the query", () => {
    const view = prepareAuditLogListData({ data: [], page: 1, totalPages: 1 }, { sortOrder: "asc" });
    assert.equal(view.filters.sortOrder.value, "asc");
  });
});