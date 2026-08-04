import employeeService from "../services/employee.service.js";
import externalBusyIntervalService from "../services/external-busy-interval.service.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as commission-jobs.js's runJob - log success, and on failure both
// log AND alert, since a sync silently failing means slots quietly go stale
// without anyone noticing until a double-booking actually happens.
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

export async function runSredimeSync() {
  return runJob("sredime-ics-sync", async () => {
    const employees = await employeeService.getEmployeesWithSredimeIcsUrl();
    if (employees.length === 0) return;

    let totalSynced = 0;
    let totalRemoved = 0;

    // Sequential, not Promise.all - a handful of employees at a 15-minute cadence
    // has no real need for parallel fetches, and sequential keeps a single slow or
    // hanging SrediMe response from spiking this job's memory/connection usage.
    for (const employee of employees) {
      try {
        const { synced, removed } = await externalBusyIntervalService.syncEmployeeFromIcs(employee);
        totalSynced += synced;
        totalRemoved += removed;
      } catch (error) {
        // One employee's feed being unreachable (bad URL, SrediMe hiccup) should
        // never stop the rest of the batch from syncing - logged and alerted
        // individually, loop continues.
        logError("[cron] SrediMe sync failed for one employee", error, { employeeId: employee._id.toString() });
        alertError("SrediMe sinhronizacija nije uspela za jednog zaposlenog", {
          employeeId: employee._id.toString(),
          errorMessage: error.message,
        });
      }
    }

    if (totalSynced > 0 || totalRemoved > 0) {
      logInfo(`[cron] SrediMe sync: ${totalSynced} intervals synced, ${totalRemoved} removed across ${employees.length} employee(s)`);
    }
  });
}

export default { runSredimeSync };