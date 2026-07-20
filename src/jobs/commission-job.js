import commissionService from "../services/commission.service.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as report-jobs.js's runJob: do the work, log success, and on
// failure both log AND alert - a cron silently failing every night is exactly
// the kind of thing that goes unnoticed for weeks, and this one moves real money.
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

export async function runCommissionGracePeriodSweep() {
  return runJob("commission-grace-period-sweep", async () => {
    const result = await commissionService.processGracePeriodCommissions();
    if (result.total > 0) {
      logInfo(`[cron] Resolved ${result.earned} earned, ${result.reversed} reversed, ${result.stillPending} still pending`);
    }
  });
}

export default { runCommissionGracePeriodSweep };