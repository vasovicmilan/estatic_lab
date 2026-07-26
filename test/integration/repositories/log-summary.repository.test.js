import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as dbHandler from "../setup/db-handler.js";
import logSummaryRepo from "../../../src/repositories/log-summary.repository.js";

describe("log-summary.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("upsertDailySummary", () => {
    it("creates a new summary for a date that doesn't exist yet", async () => {
      const created = await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 100 } });
      assert.equal(created.date, "2026-07-01");
      assert.equal(created.requests.total, 100);
      assert.ok(created.generatedAt);
    });

    it("updates (not duplicates) the existing summary for the same date", async () => {
      await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 100 } });
      const updated = await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 150 } });

      assert.equal(updated.requests.total, 150);
      const all = await logSummaryRepo.findSummariesBetween("2026-07-01", "2026-07-01");
      assert.equal(all.length, 1, "a second upsert for the same date must update, not create a duplicate");
    });

    it("refreshes generatedAt on every upsert", async () => {
      const first = await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 100 } });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 200 } });

      assert.ok(new Date(second.generatedAt).getTime() > new Date(first.generatedAt).getTime());
    });
  });

  describe("findSummaryByDate", () => {
    it("returns null for a date with no summary", async () => {
      const found = await logSummaryRepo.findSummaryByDate("2026-01-01");
      assert.equal(found, null);
    });

    it("returns the summary for an existing date", async () => {
      await logSummaryRepo.upsertDailySummary("2026-07-01", { requests: { total: 50 } });
      const found = await logSummaryRepo.findSummaryByDate("2026-07-01");
      assert.equal(found.requests.total, 50);
    });
  });

  describe("findSummariesBetween", () => {
    it("returns only summaries within the inclusive date range, sorted ascending", async () => {
      await logSummaryRepo.upsertDailySummary("2026-07-01", {});
      await logSummaryRepo.upsertDailySummary("2026-07-03", {});
      await logSummaryRepo.upsertDailySummary("2026-07-05", {});
      await logSummaryRepo.upsertDailySummary("2026-07-10", {}); // outside the range

      const result = await logSummaryRepo.findSummariesBetween("2026-07-01", "2026-07-05");

      assert.equal(result.length, 3);
      assert.deepEqual(result.map((r) => r.date), ["2026-07-01", "2026-07-03", "2026-07-05"]);
    });

    it("includes both boundary dates (inclusive range)", async () => {
      await logSummaryRepo.upsertDailySummary("2026-07-01", {});
      await logSummaryRepo.upsertDailySummary("2026-07-05", {});

      const result = await logSummaryRepo.findSummariesBetween("2026-07-01", "2026-07-05");

      assert.equal(result.length, 2);
    });
  });

  describe("findLogSummaries - admin browse view", () => {
    it("sorts most-recent-first and paginates", async () => {
      await logSummaryRepo.upsertDailySummary("2026-07-01", {});
      await logSummaryRepo.upsertDailySummary("2026-07-02", {});
      await logSummaryRepo.upsertDailySummary("2026-07-03", {});

      const result = await logSummaryRepo.findLogSummaries({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.data[0].date, "2026-07-03");
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });

    it("returns an empty page when there are no summaries at all", async () => {
      const result = await logSummaryRepo.findLogSummaries({});
      assert.equal(result.data.length, 0);
      assert.equal(result.total, 0);
    });
  });
});