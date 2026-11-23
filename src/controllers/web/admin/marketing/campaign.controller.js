import * as campaignService from "../../../../services/campaign.service.js";
import wheelService from "../../../../services/wheel.service.js";
import * as materialService from "../../../../services/material.service.js";
import { resolveAdminLimit } from "../../../../utils/pagination.util.js";
import { prepareCampaignListData, prepareCampaignDetailsData, prepareCampaignFormData } from "../../../../presenters/admin/marketing/campaign.presenter.js";
import { SORT_MAP } from "../../../../presenters/admin/marketing/campaign.presenter.js";
import { resolveAdminSort } from "../../../../utils/admin-list.util.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { normalizeError } from "../../../../utils/error.util.js";
import { toIdArray } from "../../../../utils/form-array.util.js";
import { zonedInputToUtcDate } from "../../../../utils/date.time.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

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

// the campaign form's two dropdown-like lists: wheel campaign tags that can narrow the audience, and
// the uploaded materials a "file" block can point at
async function formOptions() {
  const [sources, materials] = await Promise.all([wheelService.listSources().catch(() => []), materialService.listMaterialOptions().catch(() => [])]);
  return { sources: (sources || []).filter(Boolean).sort(), materials };
}

function buildCampaignPayload(req) {
  return {
    title: req.body.title,
    subject: req.body.subject,
    content: parseJsonField(req.body.content),
    targetInterests: toIdArray(req.body.targetInterests),
    targetSources: toIdArray(req.body.targetSources),
    onlyUnusedCoupon: parseCheckbox(req.body.onlyUnusedCoupon, false),
    status: req.body.status || "draft",
    // req.body.scheduledFor is whatever a <input type="datetime-local"> submitted -
    // see post.controller.js's identical comment on buildPostPayload.
    scheduledFor: req.body.scheduledFor ? zonedInputToUtcDate(req.body.scheduledFor) : null,
  };
}

export async function listCampaigns(req, res, next) {
  try {
    const { search, status, page = 1, limit } = req.query;

    const result = await campaignService.listCampaigns({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: resolveAdminLimit(limit),
      sort: resolveAdminSort(req.query, SORT_MAP),
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
    // a send that already happened has its own counters - the estimate only matters before it
    const recipients = campaign.statusRaw === "sent" ? null : await campaignService.countCampaignRecipients(campaignId).catch(() => null);
    const viewData = prepareCampaignDetailsData(campaign, { recipients, testEmail: req.session?.user?.email || "" });

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
    const formData = prepareCampaignFormData(null, await formOptions());
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
    const formData = prepareCampaignFormData(campaign, await formOptions());

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
      const formData = prepareCampaignFormData(null, await formOptions());
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
      const formData = prepareCampaignFormData(null, await formOptions());
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
      const formData = prepareCampaignFormData(campaign, await formOptions());
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
      const formData = prepareCampaignFormData(campaign, await formOptions());
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

// "Pošalji probni mejl": the campaign exactly as a subscriber would get it, to one address, without
// touching its status or counters
export async function sendCampaignTest(req, res, next) {
  const { campaignId } = req.params;
  const back = `/admin/newsletter/kampanje/detalji/${campaignId}`;
  try {
    if (req.validationErrors) return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), back);
    const { email } = await campaignService.sendCampaignTest(campaignId, req.body.email, req.session?.user?.firstName || "");
    logInfo(`[sendCampaignTest] Probni mejl za kampanju #${campaignId}`, { campaignId, email, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", `Probni mejl je poslat na ${email}.`, back);
  } catch (error) {
    logError("[sendCampaignTest] Greška pri slanju probnog mejla", error, { campaignId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) return flashAndRedirect(req, res, "error", message, back);
    next(error);
  }
}

// Upload for a campaign's "image" block (called by public/js/admin-content-blocks.js). Saves a
// JPEG under /images/campaigns - see multer.config.js's handleEmailImageUpload.
export function uploadCampaignImage(req, res) {
  if (!req.uploadedFile) return res.status(400).json({ success: false, message: "Izaberite sliku (JPG, PNG, WEBP ili AVIF)." });
  logInfo("[uploadCampaignImage] Slika za kampanju otpremljena", { path: req.uploadedFile.img, adminId: req.session?.user?.id });
  return res.status(201).json({ success: true, data: req.uploadedFile });
}

export async function deleteCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;
    // Snapshot before the delete - nothing left to read once deleteCampaignById returns.
    const existing = await campaignService.getCampaignForEdit(campaignId).catch(() => null);
    await campaignService.deleteCampaignById(campaignId);
    logInfo(`[deleteCampaign] Kampanja #${campaignId} obrisana`, { campaignId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "CAMPAIGN_DELETED",
      entity: { type: "Campaign", id: campaignId },
      changes: { naslov: { old: existing?.naslov || existing?.title || null, new: null } },
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
  sendCampaignTest,
  uploadCampaignImage,
  deleteCampaign,
};
