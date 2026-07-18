import LogSummary from "../models/log-summary.model.js";

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

export default { upsertDailySummary, findSummaryByDate, findSummariesBetween };