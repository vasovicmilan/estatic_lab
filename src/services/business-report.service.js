import businessReportRepo from "../repositories/business-report.repository.js";
import { zonedComponentsToUtcDate, getZonedComponents } from "../utils/date.time.util.js";
import { logInfo } from "../utils/logger.util.js";

function startOfDayUtc(year, month, day) {
  return zonedComponentsToUtcDate(year, month, day, 0, 0, 0);
}

function isoWeekInfo(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const weekYear = date.getUTCFullYear();
  const firstDayOfYear = new Date(Date.UTC(weekYear, 0, 1));
  const weekNumber = Math.ceil(((date - firstDayOfYear) / 86400000 + 1) / 7);
  return { weekYear, weekNumber };
}

export function getDailyPeriod(now = new Date()) {
  const { year, month, day } = getZonedComponents(now);
  const periodStart = startOfDayUtc(year, month, day);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  const periodKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { periodKey, periodStart, periodEnd };
}

export function getWeeklyPeriod(now = new Date()) {
  const { year, month, day } = getZonedComponents(now);
  const { weekYear, weekNumber } = isoWeekInfo(year, month, day);

  const thursdayUtcCalendar = new Date(Date.UTC(year, month - 1, day));
  const dayNum = thursdayUtcCalendar.getUTCDay() || 7;
  thursdayUtcCalendar.setUTCDate(thursdayUtcCalendar.getUTCDate() + 4 - dayNum);
  const mondayUtcCalendar = new Date(thursdayUtcCalendar);
  mondayUtcCalendar.setUTCDate(mondayUtcCalendar.getUTCDate() - 3);

  const periodStart = startOfDayUtc(mondayUtcCalendar.getUTCFullYear(), mondayUtcCalendar.getUTCMonth() + 1, mondayUtcCalendar.getUTCDate());
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);

  const periodKey = `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
  return { periodKey, periodStart, periodEnd };
}

export function getMonthlyPeriod(now = new Date()) {
  const { year, month } = getZonedComponents(now);
  const periodStart = startOfDayUtc(year, month, 1);
  const periodEnd = month === 12 ? startOfDayUtc(year + 1, 1, 1) : startOfDayUtc(year, month + 1, 1);
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  return { periodKey, periodStart, periodEnd };
}

export function getQuarterlyPeriod(now = new Date()) {
  const { year, month } = getZonedComponents(now);
  const quarter = Math.ceil(month / 3);
  const startMonth = (quarter - 1) * 3 + 1;
  const periodStart = startOfDayUtc(year, startMonth, 1);
  const periodEnd = quarter === 4 ? startOfDayUtc(year + 1, 1, 1) : startOfDayUtc(year, startMonth + 3, 1);
  const periodKey = `${year}-Q${quarter}`;
  return { periodKey, periodStart, periodEnd };
}

export function getYearlyPeriod(now = new Date()) {
  const { year } = getZonedComponents(now);
  const periodStart = startOfDayUtc(year, 1, 1);
  const periodEnd = startOfDayUtc(year + 1, 1, 1);
  const periodKey = String(year);
  return { periodKey, periodStart, periodEnd };
}

const PERIOD_GETTERS = {
  daily: getDailyPeriod,
  weekly: getWeeklyPeriod,
  monthly: getMonthlyPeriod,
  quarterly: getQuarterlyPeriod,
  yearly: getYearlyPeriod,
};

export async function generateSummary(periodType, now = new Date()) {
  const getPeriod = PERIOD_GETTERS[periodType];
  if (!getPeriod) throw new Error(`Nepoznat tip perioda: ${periodType}`);

  const { periodKey, periodStart, periodEnd } = getPeriod(now);

  const [appointments, orders, packages, commissions, coupons] = await Promise.all([
    businessReportRepo.aggregateAppointments(periodStart, periodEnd),
    businessReportRepo.aggregateOrders(periodStart, periodEnd),
    businessReportRepo.aggregatePackages(periodStart, periodEnd),
    businessReportRepo.aggregateCommissions(periodStart, periodEnd),
    businessReportRepo.aggregateCoupons(periodStart, periodEnd),
  ]);

  const summary = await businessReportRepo.upsertSummary(periodType, periodKey, {
    periodStart,
    periodEnd,
    appointments,
    orders,
    packages,
    commissions,
    coupons,
    generatedAt: new Date(),
  });

  logInfo("Business report summary generated", { periodType, periodKey });
  return summary;
}

export async function generatePreviousPeriodSummary(periodType, now = new Date()) {
  const getPeriod = PERIOD_GETTERS[periodType];
  if (!getPeriod) throw new Error(`Nepoznat tip perioda: ${periodType}`);

  const { periodStart: currentStart } = getPeriod(now);
  const previousMoment = new Date(currentStart.getTime() - 1);

  return generateSummary(periodType, previousMoment);
}

export async function getSummary(periodType, periodKey) {
  return businessReportRepo.findSummary(periodType, periodKey);
}

export async function listSummaries(periodType, options) {
  return businessReportRepo.listSummaries(periodType, options);
}

export async function getCurrentSummary(periodType) {
  const getPeriod = PERIOD_GETTERS[periodType];
  if (!getPeriod) throw new Error(`Nepoznat tip perioda: ${periodType}`);
  const { periodKey } = getPeriod(new Date());
  return businessReportRepo.findSummary(periodType, periodKey);
}

export default {
  getDailyPeriod,
  getWeeklyPeriod,
  getMonthlyPeriod,
  getQuarterlyPeriod,
  getYearlyPeriod,
  generateSummary,
  generatePreviousPeriodSummary,
  getSummary,
  listSummaries,
  getCurrentSummary,
};
