import { withDb } from "./_bootstrap.js";
import logReportService from "../src/services/log-report.service.js";
import emailService from "../src/services/email.service.js";

withDb("yearly-log-report", async () => {
  const year = new Date().getFullYear() - 1;
  const summary = await logReportService.getYearlySummary(year);
  await emailService.sendLogReportEmail("Godišnji izveštaj", String(year), summary);
});