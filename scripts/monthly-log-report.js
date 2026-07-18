import { withDb } from "./_bootstrap.js";
import logReportService from "../src/services/log-report.service.js";
import emailService from "../src/services/email.service.js";

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

withDb("monthly-log-report", async () => {
  const today = new Date();
  // previous calendar month, wrapping across the year boundary in January
  const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const month = today.getMonth() === 0 ? 12 : today.getMonth(); // getMonth() is 0-indexed, so "current index" = last month's 1-indexed number

  const summary = await logReportService.getMonthlySummary(year, month);
  const rangeLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  await emailService.sendLogReportEmail("Mesečni izveštaj", rangeLabel, summary);
});