import { withDb } from "./_bootstrap.js";
import businessReportService from "../src/services/business-report.service.js";
import emailService from "../src/services/email.service.js";
import { formatDate } from "../src/utils/date.time.util.js";

withDb("weekly-business-report", async () => {
  const now = new Date();
  const summary = await businessReportService.generatePreviousPeriodSummary("weekly", now);
  const rangeLabel = `${formatDate(summary.periodStart)} - ${formatDate(new Date(summary.periodEnd.getTime() - 1))}`;
  await emailService.sendBusinessReportEmail("Nedeljni poslovni izveštaj", rangeLabel, summary);
});
