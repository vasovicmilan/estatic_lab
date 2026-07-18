import { withDb } from "./_bootstrap.js";
import logReportService from "../src/services/log-report.service.js";
import emailService from "../src/services/email.service.js";
import { formatDate, toDateKey } from "../src/utils/date.time.util.js";

withDb("weekly-log-report", async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endDateStr = toDateKey(yesterday);

  const summary = await logReportService.getWeeklySummary(endDateStr);
  const rangeLabel = `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`;
  await emailService.sendLogReportEmail("Nedeljni izveštaj", rangeLabel, summary);
});