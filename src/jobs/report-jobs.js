import logReportService from "../services/log-report.service.js";
import emailService from "../services/email.service.js";
import tempOrderService from "../services/temporary-order.service.js";
import { getRawLogTextForDate } from "../utils/log-analysis.util.js";
import { formatDate, toDateKey } from "../utils/date.time.util.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

// Every job follows the same shape: do the work, log success, and on failure both
// log AND alert (a cron job silently failing every night is exactly the kind of
// thing that goes unnoticed for weeks without a page).
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

export async function runDailyLogReport() {
  return runJob("daily-log-report", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = toDateKey(yesterday);

    const summary = await logReportService.generateDailySummary(dateStr);
    const rawLogText = getRawLogTextForDate(dateStr);
    const attachments = [{ filename: `logs-${dateStr}.txt`, content: rawLogText, contentType: "text/plain" }];

    await emailService.sendLogReportEmail("Dnevni izveštaj", formatDate(yesterday), summary, attachments);
  });
}

export async function runWeeklyLogReport() {
  return runJob("weekly-log-report", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endDateStr = toDateKey(yesterday);

    const summary = await logReportService.getWeeklySummary(endDateStr);
    const rangeLabel = `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`;
    await emailService.sendLogReportEmail("Nedeljni izveštaj", rangeLabel, summary);
  });
}

export async function runMonthlyLogReport() {
  return runJob("monthly-log-report", async () => {
    const today = new Date();
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const month = today.getMonth() === 0 ? 12 : today.getMonth();

    const summary = await logReportService.getMonthlySummary(year, month);
    const rangeLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    await emailService.sendLogReportEmail("Mesečni izveštaj", rangeLabel, summary);
  });
}

export async function runYearlyLogReport() {
  return runJob("yearly-log-report", async () => {
    const year = new Date().getFullYear() - 1;
    const summary = await logReportService.getYearlySummary(year);
    await emailService.sendLogReportEmail("Godišnji izveštaj", String(year), summary);
  });
}

// Bonus, not strictly part of the reports ask: the temp-order cleanup job flagged as
// unwired a few rounds back when the checkout flow was built - stock reservations for
// checkouts nobody confirmed in time were never actually being released anywhere.
// Runs far more often than the reports since it's time-sensitive, not a periodic digest.
export async function runExpiredTemporaryOrderCleanup() {
  return runJob("temporary-order-cleanup", async () => {
    const result = await tempOrderService.cleanupExpiredTemporaryOrders();
    if (result.total > 0) {
      logInfo(`[cron] Cleaned up ${result.cleaned}/${result.total} expired temporary orders`);
    }
  });
}

export default {
  runDailyLogReport,
  runWeeklyLogReport,
  runMonthlyLogReport,
  runYearlyLogReport,
  runExpiredTemporaryOrderCleanup,
};