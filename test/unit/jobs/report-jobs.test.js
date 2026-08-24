import { describe, it } from "node:test";
import assert from "node:assert/strict";
import logReportService from "../../../src/services/log-report.service.js";
import emailService from "../../../src/services/email.service.js";
import tempOrderService from "../../../src/services/temporary-order.service.js";
import {
  runDailyLogReport,
  runWeeklyLogReport,
  runMonthlyLogReport,
  runYearlyLogReport,
  runExpiredTemporaryOrderCleanup,
} from "../../../src/jobs/report-jobs.js";

describe("report-jobs", () => {
  describe("runDailyLogReport", () => {
    it("summarizes YESTERDAY relative to the given moment, not today", async (t) => {
      let requestedDate;
      t.mock.method(logReportService, "generateDailySummary", async (dateStr) => {
        requestedDate = dateStr;
        return { requests: { total: 0 } };
      });
      const emailMock = t.mock.method(emailService, "sendLogReportEmail", async () => {});

      await runDailyLogReport(new Date("2026-08-24T00:15:00.000Z"));

      assert.equal(requestedDate, "2026-08-23");
      assert.equal(emailMock.mock.calls.length, 1);
      assert.equal(emailMock.mock.calls[0].arguments[0], "Dnevni izveštaj");
    });

    it("REGRESSION: never throws, even if the summary generation fails", async (t) => {
      t.mock.method(logReportService, "generateDailySummary", async () => {
        throw new Error("log file missing");
      });

      await assert.doesNotReject(() => runDailyLogReport());
    });
  });

  describe("runWeeklyLogReport", () => {
    it("passes yesterday as the week's end date, and includes the resolved range in the email", async (t) => {
      let requestedEndDate;
      t.mock.method(logReportService, "getWeeklySummary", async (endDateStr) => {
        requestedEndDate = endDateStr;
        return { startDate: new Date("2026-08-17"), endDate: new Date("2026-08-23"), requests: { total: 0 } };
      });
      const emailMock = t.mock.method(emailService, "sendLogReportEmail", async () => {});

      await runWeeklyLogReport(new Date("2026-08-24T00:30:00.000Z"));

      assert.equal(requestedEndDate, "2026-08-23");
      assert.equal(emailMock.mock.calls[0].arguments[0], "Nedeljni izveštaj");
    });
  });

  describe("runMonthlyLogReport", () => {
    it("reports the PREVIOUS calendar month, rolling back into last December when run in January", async (t) => {
      let capturedYear, capturedMonth;
      t.mock.method(logReportService, "getMonthlySummary", async (year, month) => {
        capturedYear = year;
        capturedMonth = month;
        return { requests: { total: 0 } };
      });
      t.mock.method(emailService, "sendLogReportEmail", async () => {});

      await runMonthlyLogReport(new Date("2026-01-15T00:45:00.000Z"));

      assert.equal(capturedYear, 2025);
      assert.equal(capturedMonth, 12);
    });

    it("reports the previous month within the same year for any other month", async (t) => {
      let capturedYear, capturedMonth;
      t.mock.method(logReportService, "getMonthlySummary", async (year, month) => {
        capturedYear = year;
        capturedMonth = month;
        return { requests: { total: 0 } };
      });
      t.mock.method(emailService, "sendLogReportEmail", async () => {});

      await runMonthlyLogReport(new Date("2026-06-10T00:45:00.000Z"));

      assert.equal(capturedYear, 2026);
      assert.equal(capturedMonth, 5);
    });
  });

  describe("runYearlyLogReport", () => {
    it("reports the previous calendar year", async (t) => {
      let capturedYear;
      t.mock.method(logReportService, "getYearlySummary", async (year) => {
        capturedYear = year;
        return { requests: { total: 0 } };
      });
      const emailMock = t.mock.method(emailService, "sendLogReportEmail", async () => {});

      await runYearlyLogReport(new Date("2027-01-01T01:00:00.000Z"));

      assert.equal(capturedYear, 2026);
      assert.equal(emailMock.mock.calls[0].arguments[0], "Godišnji izveštaj");
    });
  });

  describe("runExpiredTemporaryOrderCleanup", () => {
    it("delegates to cleanupExpiredTemporaryOrders", async (t) => {
      const cleanupMock = t.mock.method(tempOrderService, "cleanupExpiredTemporaryOrders", async () => ({ total: 3, cleaned: 3 }));

      await runExpiredTemporaryOrderCleanup();

      assert.equal(cleanupMock.mock.calls.length, 1);
    });

    it("REGRESSION: never throws, even if cleanup itself fails", async (t) => {
      t.mock.method(tempOrderService, "cleanupExpiredTemporaryOrders", async () => {
        throw new Error("DB unreachable");
      });

      await assert.doesNotReject(() => runExpiredTemporaryOrderCleanup());
    });
  });
});
