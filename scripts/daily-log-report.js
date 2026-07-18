import { withDb } from "./_bootstrap.js";
import logReportService from "../src/services/log-report.service.js";
import emailService from "../src/services/email.service.js";
import { formatDate, toDateKey } from "../src/utils/date.time.util.js";

withDb("daily-log-report", async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = toDateKey(yesterday);

  const summary = await logReportService.generateDailySummary(dateStr);
  await emailService.sendLogReportEmail("Dnevni izveštaj", formatDate(yesterday), summary);
});