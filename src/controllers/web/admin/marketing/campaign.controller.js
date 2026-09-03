import * as campaignService from "../../../../services/campaign.service.js";
import { prepareCampaignListData, prepareCampaignDetailsData, prepareCampaignFormData } from "../../../../presenters/admin/marketing/campaign.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { toIdArray } from "../../../../utils/form-array.util.js";
import { zonedInputToUtcDate } from "../../../../utils/date.time.util.js";

// content blocks are submitted as JSON from the dynamic form-builder widget
// rather than a flat form field, same as post.controller.js/product.controller.js
function parseJsonField(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildCampaignPayload(req) {
  return {
    title: req.body.title,
    subject: req.body.subject,
    content: parseJsonField(req.body.content),
    targetInterests: toIdArray(req.body.targetInterests),
    status: req.body.status || "draft",
    // req.body.scheduledFor is whatever a <input type="datetime-local"> submitted -
    // see post.controller.js's identical comment on buildPostPayload.
    scheduledFor: req.body.scheduledFor ? zonedInputToUtcDate(req.body.scheduledFor) : null,
  };
}

export async function listCampaigns(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const result = await campaignService.listCampaigns({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareCampaignListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Newsletter kampanje",
      pageDescription: "Pregled svih newsletter kampanja",
      data: viewData,
    });
  } catch (error) {
    logError("[listCampaigns] Greška pri učitavanju liste kampanja", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function campaignDetails(req, res, next) {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignService.getCampaignById(campaignId);
    const viewData = prepareCampaignDetailsData(campaign);

    return res.render("admin/_details", {
      pageTitle: `Kampanja - ${campaign.naslov}`,
      pageDescription: campaign.predmet,
      data: viewData,
    });
  } catch (error) {
    logError("[campaignDetails] Greška pri učitavanju detalja kampanje", error, { campaignId: req.params.campaignId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newCampaignForm(req, res, next) {
  try {
    const formData = prepareCampaignFormData(null);
    return res.render("admin/_form", {
      pageTitle: "Nova kampanja",
      pageDescription: "Kreiraj novu newsletter kampanju",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newCampaignForm] Greška pri prikazu forme za novu kampanju", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editCampaignForm(req, res, next) {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignService.getCampaignForEdit(campaignId);
    const formData = prepareCampaignFormData(campaign);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${campaign.title}`,
      pageDescription: campaign.subject,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editCampaignForm] Greška pri učitavanju forme za izmenu kampanje", error, { campaignId: req.params.campaignId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createCampaign(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createCampaign] Validacione greške pri kreiranju kampanje", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareCampaignFormData(null);
      return res.status(400).render("admin/_form", {
        pageTitle: "Nova kampanja",
        pageDescription: "Kreiraj novu newsletter kampanju",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildCampaignPayload(req);
    const campaign = await campaignService.createCampaign(data);
    logInfo(`[createCampaign] Kampanja kreirana: "${campaign.naslov}"`, { campaignId: campaign.id, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "CAMPAIGN_CREATED",
      entity: { type: "Campaign", id: campaign.id },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Kampanja je uspešno kreirana", `/admin/newsletter/kampanje/detalji/${campaign.id}`);
  } catch (error) {
    logError("[createCampaign] Greška pri kreiranju kampanje", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const formData = prepareCampaignFormData(null);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Nova kampanja",
        pageDescription: "Kreiraj novu newsletter kampanju",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateCampaign] Validacione greške za campaignId=${campaignId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const campaign = await campaignService.getCampaignForEdit(campaignId);
      const formData = prepareCampaignFormData(campaign);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${campaign.title}`,
        pageDescription: campaign.subject,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await campaignService.getCampaignForEdit(campaignId);
    const data = buildCampaignPayload(req);
    const updated = await campaignService.updateCampaignById(campaignId, data);
    logInfo(`[updateCampaign] Kampanja #${campaignId} ažurirana`, { campaignId, adminId: req.session?.user?.id });
    const changes = auditLogService.computeChanges(existing, await campaignService.getCampaignForEdit(campaignId), ["title", "subject", "status"]);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "CAMPAIGN_UPDATED",
      entity: { type: "Campaign", id: campaignId },
      changes,
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Kampanja je uspešno ažurirana", `/admin/newsletter/kampanje/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateCampaign] Greška pri ažuriranju kampanje", error, { campaignId: req.params.campaignId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const campaign = await campaignService.getCampaignForEdit(req.params.campaignId).catch(() => null);
      const formData = prepareCampaignFormData(campaign);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: campaign ? `Izmena - ${campaign.title}` : "Izmena kampanje",
        pageDescription: campaign?.subject || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function sendCampaignNow(req, res, next) {
  try {
    const { campaignId } = req.params;
    const sent = await campaignService.sendCampaignNow(campaignId);
    logInfo(`[sendCampaignNow] Kampanja #${campaignId} poslata`, { campaignId, sentCount: sent.poslato, failedCount: sent.neuspesno, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "CAMPAIGN_SENT",
      entity: { type: "Campaign", id: campaignId },
      changes: { sentCount: { old: null, new: sent.poslato }, failedCount: { old: null, new: sent.neuspesno } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", `Kampanja je poslata - ${sent.poslato} uspešno${sent.neuspesno ? `, ${sent.neuspesno} neuspešno` : ""}.`, `/admin/newsletter/kampanje/detalji/${campaignId}`);
  } catch (error) {
    logError("[sendCampaignNow] Greška pri slanju kampanje", error, { campaignId: req.params.campaignId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) {
      return flashAndRedirect(req, res, "error", message, `/admin/newsletter/kampanje/detalji/${req.params.campaignId}`);
    }
    next(error);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;
    await campaignService.deleteCampaignById(campaignId);
    logInfo(`[deleteCampaign] Kampanja #${campaignId} obrisana`, { campaignId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "CAMPAIGN_DELETED",
      entity: { type: "Campaign", id: campaignId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Kampanja je uspešno obrisana", "/admin/newsletter/kampanje");
  } catch (error) {
    logError("[deleteCampaign] Greška pri brisanju kampanje", error, { campaignId: req.params.campaignId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) {
      return flashAndRedirect(req, res, "error", message, "/admin/newsletter/kampanje");
    }
    next(error);
  }
}

export default {
  listCampaigns,
  campaignDetails,
  newCampaignForm,
  editCampaignForm,
  createCampaign,
  updateCampaign,
  sendCampaignNow,
  deleteCampaign,
};
