import businessReportService from "../services/business-report.service.js";
import emailService from "../services/email.service.js";
import { formatDate } from "../utils/date.time.util.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

const PERIOD_LABELS = {
  daily: "Dnevni poslovni izveštaj",
  weekly: "Nedeljni poslovni izveštaj",
  monthly: "Mesečni poslovni izveštaj",
  quarterly: "Kvartalni poslovni izveštaj",
  yearly: "Godišnji poslovni izveštaj",
};

async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

async function runPeriodReport(periodType, now) {
  const summary = await businessReportService.generatePreviousPeriodSummary(periodType, now);
  const rangeLabel = `${formatDate(summary.periodStart)} - ${formatDate(new Date(summary.periodEnd.getTime() - 1))}`;
  await emailService.sendBusinessReportEmail(PERIOD_LABELS[periodType], rangeLabel, summary);
}

export async function runDailyBusinessReport(now = new Date()) {
  return runJob("daily-business-report", () => runPeriodReport("daily", now));
}

export async function runWeeklyBusinessReport(now = new Date()) {
  return runJob("weekly-business-report", () => runPeriodReport("weekly", now));
}

export async function runMonthlyBusinessReport(now = new Date()) {
  return runJob("monthly-business-report", () => runPeriodReport("monthly", now));
}

export async function runQuarterlyBusinessReport(now = new Date()) {
  return runJob("quarterly-business-report", () => runPeriodReport("quarterly", now));
}

export async function runYearlyBusinessReport(now = new Date()) {
  return runJob("yearly-business-report", () => runPeriodReport("yearly", now));
}

export default {
  runDailyBusinessReport,
  runWeeklyBusinessReport,
  runMonthlyBusinessReport,
  runQuarterlyBusinessReport,
  runYearlyBusinessReport,
};
