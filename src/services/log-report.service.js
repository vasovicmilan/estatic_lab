import logSummaryRepo from "../repositories/log-summary.repository.js";
import { analyzeDay } from "../utils/log-analysis.util.js";
import { logInfo } from "../utils/logger.util.js";

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function mergeTopN(lists, n = 10) {
  const totals = new Map();
  for (const list of lists) {
    for (const { label, count } of list || []) {
      totals.set(label, (totals.get(label) || 0) + count);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

/**
 * Parses yesterday's (or any given day's) rotated log files and upserts the result as
 * that day's LogSummary. Idempotent - safe to re-run for the same date.
 */
export async function generateDailySummary(dateStr) {
  const analyzed = analyzeDay(dateStr);
  const saved = await logSummaryRepo.upsertDailySummary(dateStr, analyzed);
  logInfo("Daily log summary generated", { date: dateStr, requests: analyzed.requests.total, errors: analyzed.logs.errorCount });
  return saved;
}

/**
 * Combines every LogSummary between startDate and endDate (inclusive, both "YYYY-MM-DD")
 * into one aggregate. daysFound may be less than the calendar span if the app wasn't
 * running some days, or logs from before the 30-day retention window are gone.
 */
export async function aggregateRange(startDateStr, endDateStr) {
  const summaries = await logSummaryRepo.findSummariesBetween(startDateStr, endDateStr);

  const totals = {
    requests: {
      total: 0,
      byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
      // sum of daily-unique counts, not a true dedup across the whole range (that
      // would require storing raw IP sets, not just a count) - good enough for a
      // trend indicator, not exact traffic accounting
      uniqueIPs: 0,
    },
    logs: { infoCount: 0, warnCount: 0, errorCount: 0 },
  };

  for (const s of summaries) {
    totals.requests.total += s.requests?.total || 0;
    totals.requests.uniqueIPs += s.requests?.uniqueIPs || 0;
    for (const cls of ["2xx", "3xx", "4xx", "5xx"]) {
      totals.requests.byStatusClass[cls] += s.requests?.byStatusClass?.[cls] || 0;
    }
    totals.logs.infoCount += s.logs?.infoCount || 0;
    totals.logs.warnCount += s.logs?.warnCount || 0;
    totals.logs.errorCount += s.logs?.errorCount || 0;
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    daysFound: summaries.length,
    ...totals,
    topErrors: mergeTopN(summaries.map((s) => s.topErrors)),
    topUrls: mergeTopN(summaries.map((s) => s.topUrls)),
    topErrorUrls: mergeTopN(summaries.map((s) => s.topErrorUrls)),
  };
}

export async function getWeeklySummary(endDateStr = toDateStr(new Date())) {
  const endDate = new Date(endDateStr);
  const startDate = addDays(endDate, -6);
  return aggregateRange(toDateStr(startDate), endDateStr);
}

export async function getMonthlySummary(year, month) {
  // month is 1-12
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return aggregateRange(startDate, endDate);
}

export async function getYearlySummary(year) {
  return aggregateRange(`${year}-01-01`, `${year}-12-31`);
}

export default {
  generateDailySummary,
  aggregateRange,
  getWeeklySummary,
  getMonthlySummary,
  getYearlySummary,
};