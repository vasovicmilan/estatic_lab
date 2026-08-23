import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareLogDashboardData,
  prepareLogHistoryListData,
  prepareLogSummaryDetailData,
} from "../../../../../src/presenters/admin/logs/log-summary.presenter.js";

function buildRawSummary(overrides = {}) {
  return {
    date: "2026-01-01",
    isLive: false,
    generatedAt: "2026-01-02T00:00:00Z",
    requests: { total: 5000 },
    logs: { errorCount: 3 },
    perf: { avgResponseTimeMs: 120 },
    topErrors: [{ message: "500 error", count: 3 }],
    topUrls: [{ url: "/", count: 2000 }],
    topErrorUrls: [{ url: "/checkout", count: 2 }],
    ...overrides,
  };
}

describe("prepareLogDashboardData", () => {
  it("passes today's summary through with defaults for missing optional fields", () => {
    const view = prepareLogDashboardData(buildRawSummary({ topErrors: undefined }));
    assert.equal(view.today.date, "2026-01-01");
    assert.deepEqual(view.today.topErrors, []);
  });

  it("returns null for 'today' when no summary exists yet - e.g. before the first day completes", () => {
    const view = prepareLogDashboardData(null);
    assert.equal(view.today, null);
  });

  it("normalizes performance data to null when the summary has none", () => {
    const view = prepareLogDashboardData(buildRawSummary({ perf: undefined }));
    assert.equal(view.today.performance, null);
  });

  it("coerces isLive to a real boolean, not just a truthy/falsy passthrough", () => {
    const view = prepareLogDashboardData(buildRawSummary({ isLive: undefined }));
    assert.equal(view.today.isLive, false);
  });
});

describe("prepareLogHistoryListData", () => {
  it("defaults request/error counts to 0 when a day's summary is missing that data", () => {
    const result = { data: [{ date: "2026-01-01" }], page: 1, totalPages: 1 };
    const view = prepareLogHistoryListData(result);

    assert.equal(view.items[0].ukupnoZahteva, 0);
    assert.equal(view.items[0].greske, 0);
  });

  it("shows '-' for average response time when performance data wasn't recorded for that day", () => {
    const result = { data: [{ date: "2026-01-01" }], page: 1, totalPages: 1 };
    const view = prepareLogHistoryListData(result);

    assert.equal(view.items[0].prosecnoVreme, "-");
  });

  it("formats a real average response time with a unit suffix", () => {
    const result = { data: [{ date: "2026-01-01", perf: { avgResponseTimeMs: 85 } }], page: 1, totalPages: 1 };
    const view = prepareLogHistoryListData(result);

    assert.equal(view.items[0].prosecnoVreme, "85 ms");
  });

  it("links each row to its own detail page by date", () => {
    const result = { data: [{ date: "2026-01-15" }], page: 1, totalPages: 1 };
    const view = prepareLogHistoryListData(result);

    assert.equal(view.items[0].detailUrl, "/admin/logovi/istorija/2026-01-15");
  });
});

describe("prepareLogSummaryDetailData", () => {
  it("uses the summary's date as the last breadcrumb", () => {
    const view = prepareLogSummaryDetailData(buildRawSummary({ date: "2026-01-10" }));
    assert.equal(view.breadcrumbs.at(-1).label, "2026-01-10");
  });

  it("falls back to a generic 'Detalji' breadcrumb label when there's no summary at all", () => {
    const view = prepareLogSummaryDetailData(null);
    assert.equal(view.breadcrumbs.at(-1).label, "Detalji");
    assert.equal(view.summary, null);
  });
});