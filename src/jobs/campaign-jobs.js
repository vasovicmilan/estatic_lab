import campaignRepo from "../repositories/campaign.repository.js";
import campaignService from "../services/campaign.service.js";
import auditLogService from "../services/audit-log.service.js";
import { buildSystemActor } from "../utils/audit-actor.util.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as post-jobs.js/report-jobs.js/commission-jobs.js's runJob: do the
// work, log success, and on failure both log AND alert - a scheduled campaign
// that silently never goes out is exactly the kind of thing that goes
// unnoticed until someone asks "did the newsletter go out today?".
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

export async function runSendScheduledCampaigns() {
  return runJob("send-scheduled-campaigns", async () => {
    const dueCampaigns = await campaignRepo.findDueScheduledCampaigns();
    if (dueCampaigns.length === 0) return;

    let sent = 0;
    for (const campaign of dueCampaigns) {
      try {
        // goes through campaignService.sendCampaignNow (not a bulk update) so a
        // scheduled campaign sends through the exact same path - subscriber
        // resolution, email.service.js call, sentCount/failedCount recording -
        // as the admin's manual "Pošalji odmah" button
        const result = await campaignService.sendCampaignNow(campaign._id.toString());
        sent += 1;
        // Same CAMPAIGN_SENT action the admin's manual "Pošalji odmah" button
        // records (campaign.controller.js) - this job takes the exact same
        // path (see comment above), so the trail should read the same way,
        // just with a system actor instead of an admin one.
        await auditLogService.recordAuditLog({
          ...buildSystemActor(),
          action: "CAMPAIGN_SENT",
          entity: { type: "Campaign", id: campaign._id.toString() },
          changes: { sentCount: { old: null, new: result?.poslato ?? null }, failedCount: { old: null, new: result?.neuspesno ?? null } },
        });
      } catch (error) {
        // one bad campaign (e.g. every recipient's send throws) shouldn't block
        // the rest of the batch from going out on schedule
        logError(`[cron] send-scheduled-campaigns failed for campaign ${campaign._id}`, error, { campaignId: campaign._id.toString() });
        await auditLogService.recordAuditLog({
          ...buildSystemActor({ success: false, errorMessage: error.message }),
          action: "CAMPAIGN_SENT",
          entity: { type: "Campaign", id: campaign._id.toString() },
        });
      }
    }

    if (sent > 0) {
      logInfo(`[cron] Sent ${sent} of ${dueCampaigns.length} due campaign(s)`);
    }
  });
}

export default { runSendScheduledCampaigns };
