import cron from "node-cron";
import {
  runDailyLogReport,
  runWeeklyLogReport,
  runMonthlyLogReport,
  runYearlyLogReport,
  runExpiredTemporaryOrderCleanup,
} from "./report-jobs.js";
import { runCommissionGracePeriodSweep } from "./commission-jobs.js";
import { runPublishScheduledPosts } from "./post-jobs.js";
import { runSendScheduledCampaigns } from "./campaign-jobs.js";
import { runSredimeSync } from "./sredime-jobs.js";
import { runAppointmentReminders } from "./appointment-reminder-jobs.js";
import {
  runDailyBusinessReport,
  runWeeklyBusinessReport,
  runMonthlyBusinessReport,
  runQuarterlyBusinessReport,
  runYearlyBusinessReport,
} from "./business-report-jobs.js";
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
  cron.schedule("15 0 * * *", () => runDailyLogReport(), { timezone: TIMEZONE });

  // Weekly report - Monday 00:30, covers the 7 days ending yesterday
  cron.schedule("30 0 * * 1", () => runWeeklyLogReport(), { timezone: TIMEZONE });

  // Monthly report - 1st of the month, 00:45, covers the full previous month
  cron.schedule("45 0 1 * *", () => runMonthlyLogReport(), { timezone: TIMEZONE });

  // Yearly report - Jan 1st, 01:00, covers the full previous year
  cron.schedule("0 1 1 1 *", () => runYearlyLogReport(), { timezone: TIMEZONE });

  // Temp-order cleanup - hourly. Only removes orders past the full retention window
  // (token TTL + grace period, see shop.config.js) - not urgent by design, since the
  // whole point of the grace period is to give admin/customer time to sort it out
  // before anything is actually deleted.
  cron.schedule("0 * * * *", () => runExpiredTemporaryOrderCleanup(), { timezone: TIMEZONE });

  // Commission grace-period sweep - once daily, 02:00. Not time-sensitive down to
  // the hour (the 14-day withdrawal window doesn't move minute to minute), but
  // frequent enough that a partner's payable balance doesn't sit stale for long.
  cron.schedule("0 2 * * *", () => runCommissionGracePeriodSweep(), { timezone: TIMEZONE });

  // Scheduled blog post publisher - every 5 minutes. Frequent enough that a post
  // scheduled for e.g. 09:00 actually goes live close to 09:00 rather than sitting
  // "scheduled" for up to an hour, without being so frequent it's pointless load.
  cron.schedule("*/5 * * * *", () => runPublishScheduledPosts(), { timezone: TIMEZONE });

  // Scheduled newsletter campaign sender - every 5 minutes, same cadence and
  // same reasoning as the scheduled blog post publisher just above: a
  // campaign scheduled for e.g. 09:00 should actually go out close to 09:00.
  cron.schedule("*/5 * * * *", () => runSendScheduledCampaigns(), { timezone: TIMEZONE });

  // SrediMe ICS sync - every 15 minutes. Keeps cached external busy intervals
  // (see external-busy-interval.model.js) fresh enough that a booking made
  // through SrediMe reliably shows up here well before the next customer looks
  // at that employee's slots, without hammering SrediMe's server every minute.
  cron.schedule("*/15 * * * *", () => runSredimeSync(), { timezone: TIMEZONE });

  // Appointment reminders (24h and 4h before, see reminder.config.js) - every
  // 15 minutes. The underlying query window is wide (now up to the window
  // edge, guarded by the reminderXSentAt null check - see
  // appointment.repository.js's findAppointmentsDueForReminder), so this
  // frequency is about responsiveness, not correctness: a missed run just
  // means the reminder goes out a few minutes later next tick, never twice
  // and never silently skipped.
  cron.schedule("*/15 * * * *", () => runAppointmentReminders(), { timezone: TIMEZONE });

  // Business reports (bookings/sales/commissions/coupons - see
  // business-report.service.js) - a genuinely different report from the
  // operational log reports above (see docs section 14's distinction).
  // Offset by 5-15 minutes from their operational counterparts so both don't
  // fire in the same minute and contend for the same DB.
  //
  // IMPORTANT: every job below is registered as `() => runXxx()`, NOT
  // `runXxx` directly. node-cron v4's TaskFn signature is always called with
  // a TaskContext object (see node_modules/node-cron/dist/node-cron.d.ts -
  // `type TaskFn = (context: TaskContext) => any`), never with zero
  // arguments/undefined. Every one of these job functions has a `now = new
  // Date()` default parameter meant to only apply when called with no
  // argument - passing `runDailyBusinessReport` directly would silently bind
  // `now` to node-cron's TaskContext object instead of letting the default
  // kick in, and every date computation downstream would then operate on a
  // non-Date value, eventually throwing "RangeError: Invalid time value" (the
  // exact bug this fixes - see PROMENE-README.md for the full story). This
  // wrapping is applied to every job on this page now, not just the ones
  // that happened to break, since any function relying on a real "no
  // arguments were passed" default is equally at risk here.
  cron.schedule("20 0 * * *", () => runDailyBusinessReport(), { timezone: TIMEZONE });
  cron.schedule("35 0 * * 1", () => runWeeklyBusinessReport(), { timezone: TIMEZONE });
  cron.schedule("50 0 1 * *", () => runMonthlyBusinessReport(), { timezone: TIMEZONE });
  // 1st of Jan/Apr/Jul/Oct - the four calendar-quarter boundaries
  cron.schedule("5 1 1 1,4,7,10 *", () => runQuarterlyBusinessReport(), { timezone: TIMEZONE });
  cron.schedule("15 1 1 1 *", () => runYearlyBusinessReport(), { timezone: TIMEZONE });

  logInfo(`[cron] Scheduler started (timezone: ${TIMEZONE})`);
}

export default { startScheduler };
