import { withDb } from "./_bootstrap.js";
import businessReportService from "../src/services/business-report.service.js";
import emailService from "../src/services/email.service.js";
import { formatDate } from "../src/utils/date.time.util.js";

// Manual counterpart to the "daily-business-report" cron job (src/jobs/business-report-jobs.js).
// Deliberately does NOT reuse that job's runDailyBusinessReport() - that wrapper
// swallows errors into a Telegram alert instead of surfacing them, which is right
// for an unattended cron run but wrong here: run by hand, a failure should show
// its real error and exit non-zero (withDb below handles that), the same way
// daily-log-report.js already behaves for log reports.
withDb("daily-business-report", async () => {
  const now = new Date();
  const summary = await businessReportService.generatePreviousPeriodSummary("daily", now);
  const rangeLabel = `${formatDate(summary.periodStart)} - ${formatDate(new Date(summary.periodEnd.getTime() - 1))}`;
  await emailService.sendBusinessReportEmail("Dnevni poslovni izveštaj", rangeLabel, summary);
});
