import { withDb } from "./_bootstrap.js";
import businessReportService from "../src/services/business-report.service.js";
import emailService from "../src/services/email.service.js";
import { formatDate } from "../src/utils/date.time.util.js";

// The one period type that only exists on the business-report side (log reports
// have no quarterly cadence), included here for parity with the full set of
// period types src/jobs/business-report-jobs.js actually schedules.
withDb("quarterly-business-report", async () => {
  const now = new Date();
  const summary = await businessReportService.generatePreviousPeriodSummary("quarterly", now);
  const rangeLabel = `${formatDate(summary.periodStart)} - ${formatDate(new Date(summary.periodEnd.getTime() - 1))}`;
  await emailService.sendBusinessReportEmail("Kvartalni poslovni izveštaj", rangeLabel, summary);
});
