import LogSummary from "../models/log-summary.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function upsertDailySummary(date, data) {
  return LogSummary.findOneAndUpdate(
    { date },
    { ...data, date, generatedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function findSummaryByDate(date) {
  return LogSummary.findOne({ date }).lean();
}

export async function findSummariesBetween(startDate, endDate) {
  return LogSummary.find({ date: { $gte: startDate, $lte: endDate } })
    .sort({ date: 1 })
    .lean();
}

// most-recent-first, paginated - for an admin browse view of past daily summaries
export async function findLogSummaries({ limit = 20, page = 1 } = {}) {
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    LogSummary.find({}).sort({ date: -1 }).skip(skip).limit(resolvedLimit).lean(),
    LogSummary.countDocuments({}),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export default { upsertDailySummary, findSummaryByDate, findSummariesBetween, findLogSummaries };