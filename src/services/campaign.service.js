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
// received it" already can't be un-sent anyway.
function assertNotSent(campaign) {
  if (campaign.status === "sent") badRequest("Poslata kampanja se ne može menjati");
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

// Shared by the "Pošalji sada" admin action and jobs/campaign-jobs.js's
// scheduled sweep - both just need "render, resolve recipients, send, record
// the outcome" with no other difference between them.
export async function sendCampaignNow(campaignId) {
  if (!campaignId) validationError("campaignId");
  const campaign = await campaignRepo.findCampaignDocById(campaignId);
  if (!campaign) notFound("Kampanja");
  if (campaign.status === "sent") badRequest("Kampanja je već poslata");

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

export default {
  listCampaigns,
  getCampaignById,
  getCampaignForEdit,
  createCampaign,
  updateCampaignById,
  deleteCampaignById,
  sendCampaignNow,
};
