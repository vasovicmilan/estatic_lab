import * as businessPartnerService from "../../../../services/business-partner.service.js";
import {
  prepareBusinessPartnerListData,
  prepareBusinessPartnerDetailsData,
  prepareBusinessPartnerFormData,
} from "../../../../presenters/admin/marketing/business-partner.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";
import { normalizeError } from "../../../../utils/error.util.js";

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

function buildBusinessPartnerPayload(req, existing = {}) {
  const data = { ...req.body };

  data.coverImage = req.uploadedFiles?.coverImage
    ? { img: req.uploadedFiles.coverImage.img, imgDesc: req.body.coverImageDesc || req.uploadedFiles.coverImage.imgDesc || "" }
    : existing.coverImage || null;

  data.content = parseJsonField(req.body.content, existing.content || []);
  data.isActive = parseCheckbox(req.body.isActive, existing.isActive ?? true);

  data.geo = {
    latitude: req.body.latitude !== "" && req.body.latitude != null ? Number(req.body.latitude) : null,
    longitude: req.body.longitude !== "" && req.body.longitude != null ? Number(req.body.longitude) : null,
  };
  delete data.latitude;
  delete data.longitude;
  delete data.coverImageDesc;

  return data;
}

export async function listBusinessPartners(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const result = await businessPartnerService.listBusinessPartners({
      search: search || "",
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareBusinessPartnerListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Saradnici",
      pageDescription: "Pregled svih poslovnih saradnika prikazanih na sajtu",
      data: viewData,
    });
  } catch (error) {
    logError("[listBusinessPartners] Greška pri učitavanju liste saradnika", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function businessPartnerDetails(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await businessPartnerService.getBusinessPartnerById(partnerId);
    const viewData = prepareBusinessPartnerDetailsData(partner);

    return res.render("admin/_details", {
      pageTitle: `Saradnik - ${partner.naziv}`,
      pageDescription: partner.kratakOpis,
      data: viewData,
    });
  } catch (error) {
    logError("[businessPartnerDetails] Greška pri učitavanju detalja saradnika", error, { partnerId: req.params.partnerId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newBusinessPartnerForm(req, res, next) {
  try {
    const formData = prepareBusinessPartnerFormData(null);
    return res.render("admin/_form", {
      pageTitle: "Novi saradnik",
      pageDescription: "Dodaj novog poslovnog saradnika",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newBusinessPartnerForm] Greška pri prikazu forme za novog saradnika", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editBusinessPartnerForm(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
    const formData = prepareBusinessPartnerFormData(partner);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${partner.name}`,
      pageDescription: partner.shortDescription,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editBusinessPartnerForm] Greška pri učitavanju forme za izmenu saradnika", error, { partnerId: req.params.partnerId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createBusinessPartner(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createBusinessPartner] Validacione greške pri kreiranju saradnika", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareBusinessPartnerFormData(null);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi saradnik",
        pageDescription: "Dodaj novog poslovnog saradnika",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildBusinessPartnerPayload(req);
    const partner = await businessPartnerService.createBusinessPartner(data);
    logInfo(`[createBusinessPartner] Saradnik kreiran: "${partner.naziv}"`, { partnerId: partner.id, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "BUSINESS_PARTNER_CREATED",
      entity: { type: "BusinessPartner", id: partner.id },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Saradnik je uspešno kreiran", `/admin/saradnici/detalji/${partner.id}`);
  } catch (error) {
    logError("[createBusinessPartner] Greška pri kreiranju saradnika", error, { body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      const formData = prepareBusinessPartnerFormData(null);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Novi saradnik",
        pageDescription: "Dodaj novog poslovnog saradnika",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateBusinessPartner(req, res, next) {
  try {
    const { partnerId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateBusinessPartner] Validacione greške za partnerId=${partnerId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const partner = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
      const formData = prepareBusinessPartnerFormData(partner);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${partner.name}`,
        pageDescription: partner.shortDescription,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
    const data = buildBusinessPartnerPayload(req, existing);
    const updated = await businessPartnerService.updateBusinessPartnerById(partnerId, data);
    logInfo(`[updateBusinessPartner] Saradnik #${partnerId} ažuriran`, { partnerId, adminId: req.session?.user?.id });
    const afterUpdate = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["name", "shortDescription", "outboundUrl", "isActive"]);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "BUSINESS_PARTNER_UPDATED",
      entity: { type: "BusinessPartner", id: partnerId },
      changes,
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Saradnik je uspešno ažuriran", `/admin/saradnici/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateBusinessPartner] Greška pri ažuriranju saradnika", error, { partnerId: req.params.partnerId, body: req.body, userId: req.session?.user?.id });

    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const partner = await businessPartnerService.getBusinessPartnerForEdit(req.params.partnerId).catch(() => null);
      const formData = prepareBusinessPartnerFormData(partner);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: partner ? `Izmena - ${partner.name}` : "Izmena saradnika",
        pageDescription: partner?.shortDescription || "",
        data: { ...formData, errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteBusinessPartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    await businessPartnerService.deleteBusinessPartnerById(partnerId);
    logInfo(`[deleteBusinessPartner] Saradnik #${partnerId} obrisan`, { partnerId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "BUSINESS_PARTNER_DELETED",
      entity: { type: "BusinessPartner", id: partnerId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Saradnik je uspešno obrisan", "/admin/saradnici");
  } catch (error) {
    logError("[deleteBusinessPartner] Greška pri brisanju saradnika", error, { partnerId: req.params.partnerId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) {
      return flashAndRedirect(req, res, "error", message, "/admin/saradnici");
    }
    next(error);
  }
}

export default {
  listBusinessPartners,
  businessPartnerDetails,
  newBusinessPartnerForm,
  editBusinessPartnerForm,
  createBusinessPartner,
  updateBusinessPartner,
  deleteBusinessPartner,
};
