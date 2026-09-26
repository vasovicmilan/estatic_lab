import campaignRepo from "../repositories/campaign.repository.js";
import newsLetterRepo from "../repositories/news-letter.repository.js";
import { mapCampaignsForAdminList, mapCampaignForAdminDetail, mapCampaignForEdit } from "../mappers/campaign.mapper.js";
import { renderCampaignContentToEmailHtml } from "../utils/campaign-content.util.js";
import emailService from "./email.service.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { BUSINESS } from "../config/business.config.js";

// Now sourced from business.config.js's siteUrl instead of a locally redefined
// fallback (see business.config.js comment for why this was centralized).
const BASE_URL = BUSINESS.siteUrl;

export async function listCampaigns({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await campaignRepo.findCampaigns({ search, limit, page, filters });
  return { data: mapCampaignsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getCampaignById(campaignId) {
  if (!campaignId) validationError("campaignId");
  const campaign = await campaignRepo.findCampaignById(campaignId);
  if (!campaign) notFound("Kampanja");
  return mapCampaignForAdminDetail(campaign);
}

export async function getCampaignForEdit(campaignId) {
  if (!campaignId) validationError("campaignId");
  const campaign = await campaignRepo.findCampaignById(campaignId);
  if (!campaign) notFound("Kampanja");
  return mapCampaignForEdit(campaign);
}

// A sent campaign is a historical record of what actually went out - editing it
// after the fact would make that record lie, and "content, subject, and who
// received it" already can't be un-sent anyway. "sending" is blocked too - it's
// the brief in-flight state between the cron sweep's atomic claim (see
// campaign.repository.js's claimDueCampaignForSending) and the send actually
// completing, and editing content out from under a send already in progress
// would be at least as confusing as editing a sent one.
function assertNotSent(campaign) {
  if (campaign.status === "sent") badRequest("Poslata kampanja se ne može menjati");
  if (campaign.status === "sending") badRequest("Kampanja se trenutno šalje i ne može se menjati");
}

export async function createCampaign(data) {
  if (!data.title) validationError("title");
  if (!data.subject) validationError("subject");

  const created = await campaignRepo.createCampaign({
    title: data.title,
    subject: data.subject,
    content: data.content || [],
    targetInterests: data.targetInterests || [],
    status: data.status || "draft",
    scheduledFor: data.status === "scheduled" ? data.scheduledFor : null,
  });
  logInfo("Campaign created", { campaignId: created._id, title: created.title, status: created.status });
  return getCampaignById(created._id);
}

export async function updateCampaignById(campaignId, data) {
  if (!campaignId) validationError("campaignId");
  const existing = await campaignRepo.findCampaignById(campaignId);
  if (!existing) notFound("Kampanja");
  assertNotSent(existing);

  const status = data.status || existing.status;
  if (status === "scheduled") {
    const scheduledFor = data.scheduledFor || existing.scheduledFor;
    if (!scheduledFor) validationError("scheduledFor");
    if (new Date(scheduledFor) <= new Date()) badRequest("Datum zakazivanja mora biti u budućnosti");
  }

  const updated = await campaignRepo.updateCampaignById(campaignId, {
    title: data.title ?? existing.title,
    subject: data.subject ?? existing.subject,
    content: data.content ?? existing.content,
    targetInterests: data.targetInterests ?? existing.targetInterests,
    status,
    scheduledFor: status === "scheduled" ? data.scheduledFor ?? existing.scheduledFor : null,
  });
  logInfo("Campaign updated", { campaignId, updatedFields: Object.keys(data) });
  return getCampaignById(updated._id);
}

export async function deleteCampaignById(campaignId) {
  if (!campaignId) validationError("campaignId");
  const existing = await campaignRepo.findCampaignById(campaignId);
  if (!existing) notFound("Kampanja");
  assertNotSent(existing);
  await campaignRepo.deleteCampaignById(campaignId);
  logInfo("Campaign deleted", { campaignId });
  return { success: true };
}

// The actual "render, resolve recipients, send, record the outcome" work,
// shared by the "Pošalji sada" admin path and the scheduled cron sweep below -
// takes the live Mongoose doc (already fetched/claimed by the caller) so it can
// just mutate + .save() it, with no re-fetch or status check of its own.
async function performSend(campaign) {
  const campaignId = campaign._id.toString();
  const subscribers = campaign.targetInterests.length
    ? await newsLetterRepo.findActiveSubscribersByInterests(campaign.targetInterests)
    : await newsLetterRepo.findAllActiveSubscribers();

  const body = renderCampaignContentToEmailHtml(campaign.content, BASE_URL);
  const results = subscribers.length ? await emailService.sendNewsletterCampaign(subscribers, { subject: campaign.subject, body }) : [];

  const sentCount = results.filter((r) => r.sent).length;
  const failedCount = results.filter((r) => !r.sent).length;
  if (failedCount > 0) {
    logError(`[campaign] ${failedCount} of ${results.length} send(s) failed`, null, {
      campaignId,
      failed: results.filter((r) => !r.sent).map((r) => r.email),
    });
  }

  campaign.status = "sent";
  campaign.sentAt = new Date();
  campaign.sentCount = sentCount;
  campaign.failedCount = failedCount;
  // .save() (not a bulk update) is deliberate - it's what lets Campaign's own
  // pre("save") hook run consistently with every other write to this document,
  // same reasoning as post-jobs.js's use of post.save() over a raw update.
  await campaign.save();

  logInfo("Campaign sent", { campaignId, recipientCount: subscribers.length, sentCount, failedCount });
  return getCampaignById(campaignId);
}

// Used by the "Pošalji sada" admin action only - a human clicking a button on
// one specific campaign they're looking at right now, so there's no
// overlapping-cron-tick race to guard against here (see sendScheduledCampaign
// below for that).
export async function sendCampaignNow(campaignId) {
  if (!campaignId) validationError("campaignId");
  const campaign = await campaignRepo.findCampaignDocById(campaignId);
  if (!campaign) notFound("Kampanja");
  if (campaign.status === "sent") badRequest("Kampanja je već poslata");
  if (campaign.status === "sending") badRequest("Kampanja se trenutno šalje");

  return performSend(campaign);
}

// Used by jobs/campaign-jobs.js's scheduled sweep. Unlike sendCampaignNow, this
// first does an ATOMIC claim (status "scheduled" -> "sending", only if still
// due) via campaignRepo.claimDueCampaignForSending - this is what actually
// closes the race: if a previous tick's sweep is still mid-send on this exact
// campaign when this tick's findDueScheduledCampaigns also picked it up (still
// "scheduled" in the DB at read time), only one of the two ticks' claims can
// match, so only one ever reaches performSend. A null claim means "some other
// tick already has (or is already through with) this one" and the caller must
// skip it, never re-send it. If the send itself throws after being claimed
// (e.g. the mail provider is down), the campaign is moved to "failed" rather
// than left stuck in "sending" - "failed" isn't picked up by
// findDueScheduledCampaigns, so a bad send is surfaced to an admin instead of
// being silently retried (and re-sent to whoever it already partially reached)
// forever.
export async function sendScheduledCampaign(campaignId) {
  if (!campaignId) validationError("campaignId");
  const claimed = await campaignRepo.claimDueCampaignForSending(campaignId);
  if (!claimed) {
    logInfo("[campaign] Skipping campaign already claimed by another run", { campaignId: campaignId.toString() });
    return null;
  }

  try {
    return await performSend(claimed);
  } catch (error) {
    await campaignRepo.markCampaignSendFailed(campaignId);
    throw error;
  }
}

export default {
  listCampaigns,
  getCampaignById,
  getCampaignForEdit,
  createCampaign,
  updateCampaignById,
  deleteCampaignById,
  sendCampaignNow,
  sendScheduledCampaign,
};
