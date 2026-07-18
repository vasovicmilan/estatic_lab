import cron from "node-cron";
import {
  runDailyLogReport,
  runWeeklyLogReport,
  runMonthlyLogReport,
  runYearlyLogReport,
  runExpiredTemporaryOrderCleanup,
} from "./report-jobs.js";
import { logInfo } from "../utils/logger.util.js";

const TIMEZONE = process.env.CRON_TIMEZONE || "Europe/Belgrade";

// PM2 sets NODE_APP_INSTANCE to "0", "1", "2"... per worker when running in cluster
// mode (-i 2 or higher). Outside PM2, or with a single instance, this is undefined -
// treated the same as instance 0. Only the one designated instance schedules jobs,
// otherwise every worker would independently fire the same jobs and you'd get N
// copies of every report email.
const INSTANCE_ID = process.env.NODE_APP_INSTANCE;
const IS_SCHEDULER_INSTANCE = INSTANCE_ID === undefined || INSTANCE_ID === "0";

export function startScheduler() {
  if (!IS_SCHEDULER_INSTANCE) {
    logInfo(`[cron] Skipping scheduler on instance ${INSTANCE_ID} - only instance 0 runs scheduled jobs`);
    return;
  }

  // Daily report - 00:15, so yesterday's logs have fully rotated first
  cron.schedule("15 0 * * *", runDailyLogReport, { timezone: TIMEZONE });

  // Weekly report - Monday 00:30, covers the 7 days ending yesterday
  cron.schedule("30 0 * * 1", runWeeklyLogReport, { timezone: TIMEZONE });

  // Monthly report - 1st of the month, 00:45, covers the full previous month
  cron.schedule("45 0 1 * *", runMonthlyLogReport, { timezone: TIMEZONE });

  // Yearly report - Jan 1st, 01:00, covers the full previous year
  cron.schedule("0 1 1 1 *", runYearlyLogReport, { timezone: TIMEZONE });

  // Temp-order cleanup - hourly. Only removes orders past the full retention window
  // (token TTL + grace period, see shop.config.js) - not urgent by design, since the
  // whole point of the grace period is to give admin/customer time to sort it out
  // before anything is actually deleted.
  cron.schedule("0 * * * *", runExpiredTemporaryOrderCleanup, { timezone: TIMEZONE });

  logInfo(`[cron] Scheduler started (timezone: ${TIMEZONE})`);
}

export default { startScheduler };