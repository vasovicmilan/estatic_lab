import commissionService from "../services/commission.service.js";
import auditLogService from "../services/audit-log.service.js";
import { buildSystemActor } from "../utils/audit-actor.util.js";
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
      // One aggregate entry for the whole sweep, not one per commission entry -
      // this genuinely moves money (grace-period commissions flipping to
      // "earned"/"reversed"), so it belongs in the trail, but the sweep can
      // touch a large batch at once and a per-entry entry would just be noise
      // for what's fundamentally one system decision applied uniformly.
      await auditLogService.recordAuditLog({
        ...buildSystemActor(),
        action: "COMMISSION_GRACE_PERIOD_SWEPT",
        entity: { type: "Commission", id: null },
        changes: {
          earned: { old: null, new: result.earned },
          reversed: { old: null, new: result.reversed },
          stillPending: { old: null, new: result.stillPending },
        },
      });
    }
  });
}

export default { runCommissionGracePeriodSweep };