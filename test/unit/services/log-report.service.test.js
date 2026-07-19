import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logSummaryRepo from "../../../src/repositories/log-summary.repository.js";
import * as logReportService from "../../../src/services/log-report.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, "..", "..", "..", "logs");
const IS_PROD = process.env.NODE_ENV === "production";
const baseFileName = (name) => (IS_PROD ? name : `${name}-dev`);
const TEST_DATE = "2099-02-01";

function summaryFixture(overrides = {}) {
  return {
    requests: { total: 10, byStatusClass: { "2xx": 7, "3xx": 1, "4xx": 1, "5xx": 1 }, uniqueIPs: 3 },
    logs: { infoCount: 20, warnCount: 2, errorCount: 1 },
    topErrors: [{ label: "Error A", count: 1 }],
    topUrls: [{ label: "GET /", count: 5 }],
    topErrorUrls: [{ label: "404 GET /x", count: 1 }],
    ...overrides,
  };
}

describe("log-report.service", () => {
  describe("aggregateRange", () => {
    it("sums requests/logs across every day found", async (t) => {
      t.mock.method(logSummaryRepo, "findSummariesBetween", async () => [
        summaryFixture({ requests: { total: 10, byStatusClass: { "2xx": 10, "3xx": 0, "4xx": 0, "5xx": 0 }, uniqueIPs: 2 } }),
        summaryFixture({ requests: { total: 5, byStatusClass: { "2xx": 5, "3xx": 0, "4xx": 0, "5xx": 0 }, uniqueIPs: 3 } }),
      ]);

      const result = await logReportService.aggregateRange("2026-01-01", "2026-01-02");
      assert.equal(result.requests.total, 15);
      assert.equal(result.requests.byStatusClass["2xx"], 15);
      assert.equal(result.requests.uniqueIPs, 5);
    });

    it("reports daysFound as however many summaries actually existed, not the calendar span", async (t) => {
      t.mock.method(logSummaryRepo, "findSummariesBetween", async () => [summaryFixture()]);
      // asked for a 7-day range but only 1 day of data actually exists (e.g. gaps
      // from downtime, or dates before the 30-day retention window)
      const result = await logReportService.aggregateRange("2026-01-01", "2026-01-07");
      assert.equal(result.daysFound, 1);
    });

    it("returns zeroed totals (not a crash) when no summaries exist for the range at all", async (t) => {
      t.mock.method(logSummaryRepo, "findSummariesBetween", async () => []);
      const result = await logReportService.aggregateRange("2026-01-01", "2026-01-07");
      assert.equal(result.requests.total, 0);
      assert.equal(result.daysFound, 0);
      assert.deepEqual(result.topErrors, []);
    });

    it("merges identical error labels across days into one combined count", async (t) => {
      t.mock.method(logSummaryRepo, "findSummariesBetween", async () => [
        summaryFixture({ topErrors: [{ label: "DB timeout", count: 3 }] }),
        summaryFixture({ topErrors: [{ label: "DB timeout", count: 2 }] }),
      ]);
      const result = await logReportService.aggregateRange("2026-01-01", "2026-01-02");
      const dbTimeout = result.topErrors.find((e) => e.label === "DB timeout");
      assert.equal(dbTimeout.count, 5);
    });

    it("limits the merged top-N lists to at most 10 entries, ranked by count", async (t) => {
      const manyErrors = Array.from({ length: 15 }, (_, i) => ({ label: `Error ${i}`, count: i + 1 }));
      t.mock.method(logSummaryRepo, "findSummariesBetween", async () => [summaryFixture({ topErrors: manyErrors })]);
      const result = await logReportService.aggregateRange("2026-01-01", "2026-01-01");
      assert.equal(result.topErrors.length, 10);
      assert.equal(result.topErrors[0].label, "Error 14", "highest count should be first");
    });
  });

  describe("getWeeklySummary - date range calculation", () => {
    it("spans exactly 7 days (6 days back plus the end date itself)", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getWeeklySummary("2026-01-15");
      assert.equal(capturedRange.start, "2026-01-09");
      assert.equal(capturedRange.end, "2026-01-15");
    });

    it("correctly crosses a month boundary", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getWeeklySummary("2026-02-03");
      assert.equal(capturedRange.start, "2026-01-28");
    });
  });

  describe("getMonthlySummary - date range calculation", () => {
    it("spans the full calendar month for a 31-day month", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getMonthlySummary(2026, 1);
      assert.equal(capturedRange.start, "2026-01-01");
      assert.equal(capturedRange.end, "2026-01-31");
    });

    it("correctly handles February in a non-leap year (28 days)", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getMonthlySummary(2026, 2);
      assert.equal(capturedRange.end, "2026-02-28");
    });

    it("correctly handles February in a leap year (29 days)", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getMonthlySummary(2028, 2);
      assert.equal(capturedRange.end, "2028-02-29");
    });
  });

  describe("getYearlySummary - date range calculation", () => {
    it("spans the full calendar year", async (t) => {
      let capturedRange;
      t.mock.method(logSummaryRepo, "findSummariesBetween", async (start, end) => {
        capturedRange = { start, end };
        return [];
      });
      await logReportService.getYearlySummary(2026);
      assert.equal(capturedRange.start, "2026-01-01");
      assert.equal(capturedRange.end, "2026-12-31");
    });
  });

  describe("generateDailySummary - real file parsing + mocked persistence", () => {
    beforeEach(cleanup);
    afterEach(cleanup);

    function cleanup() {
      if (!fs.existsSync(LOGS_DIR)) return;
      for (const f of fs.readdirSync(LOGS_DIR)) {
        if (f.includes(TEST_DATE)) fs.unlinkSync(path.join(LOGS_DIR, f));
      }
    }

    it("parses the real log files for the date and upserts the result", async (t) => {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(LOGS_DIR, `${baseFileName("app")}.${TEST_DATE}.1.log`),
        JSON.stringify({ level: "error", time: new Date().toISOString(), msg: "Test error" }) + "\n"
      );

      let upsertedPayload;
      t.mock.method(logSummaryRepo, "upsertDailySummary", async (dateStr, data) => {
        upsertedPayload = data;
        return { date: dateStr, ...data };
      });

      await logReportService.generateDailySummary(TEST_DATE);
      assert.equal(upsertedPayload.logs.errorCount, 1);
    });
  });
});