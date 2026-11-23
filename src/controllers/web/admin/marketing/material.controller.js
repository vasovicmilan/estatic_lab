import QRCode from "qrcode";
import * as materialService from "../../../../services/material.service.js";
import { resolveAdminLimit } from "../../../../utils/pagination.util.js";
import {
  prepareMaterialListData,
  prepareMaterialDetailsData,
  prepareMaterialFormData,
  SORT_MAP,
} from "../../../../presenters/admin/marketing/material.presenter.js";
import { resolveAdminSort } from "../../../../utils/admin-list.util.js";
import { removeMaterialFile } from "../../../../config/material-upload.config.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";
import { normalizeError } from "../../../../utils/error.util.js";

function buildPayload(req, existing = {}) {
  return {
    title: req.body.title,
    description: req.body.description ?? "",
    isActive: parseCheckbox(req.body.isActive, existing.isActive ?? true),
  };
}

// the upload middleware already wrote the file when validation fails afterwards - don't leave it behind
async function discardUpload(req) {
  if (req.uploadedMaterial) await removeMaterialFile(req.uploadedMaterial.storedName);
}

export async function listMaterials(req, res, next) {
  try {
    const { search, page = 1, limit } = req.query;
    const result = await materialService.listMaterials({
      search: search || "",
      page: parseInt(page, 10) || 1,
      limit: resolveAdminLimit(limit),
      sort: resolveAdminSort(req.query, SORT_MAP),
    });

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Materijali",
      pageDescription: "Ponude, brošure i drugi fajlovi za preuzimanje (QR kod i newsletter)",
      data: prepareMaterialListData(result, req.query),
    });
  } catch (error) {
    logError("[listMaterials] Greška pri učitavanju liste materijala", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function materialDetails(req, res, next) {
  try {
    const { materialId } = req.params;
    const material = await materialService.getMaterialById(materialId);
    const publicUrl = materialService.buildMaterialUrl(material.slug);
    const qrSvg = await QRCode.toString(publicUrl, { type: "svg", margin: 2, errorCorrectionLevel: "M", width: 240 });

    return res.render("admin/_details", {
      pageTitle: `Materijal - ${material.naziv}`,
      pageDescription: material.opis,
      data: prepareMaterialDetailsData(material, { publicUrl, qrSvg }),
    });
  } catch (error) {
    logError("[materialDetails] Greška pri učitavanju materijala", error, { materialId: req.params.materialId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newMaterialForm(req, res, next) {
  try {
    return res.render("admin/_form", {
      pageTitle: "Novi materijal",
      pageDescription: "Otpremi ponudu, brošuru ili drugi fajl",
      data: { ...prepareMaterialFormData(null), errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    next(error);
  }
}

export async function editMaterialForm(req, res, next) {
  try {
    const material = await materialService.getMaterialForEdit(req.params.materialId);
    return res.render("admin/_form", {
      pageTitle: `Izmena - ${material.title}`,
      pageDescription: material.description,
      data: { ...prepareMaterialFormData(material), errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editMaterialForm] Greška pri učitavanju forme", error, { materialId: req.params.materialId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createMaterial(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createMaterial] Validacione greške", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      await discardUpload(req);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi materijal",
        pageDescription: "Otpremi ponudu, brošuru ili drugi fajl",
        data: { ...prepareMaterialFormData(null), errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const material = await materialService.createMaterial(buildPayload(req), req.uploadedMaterial);
    logInfo(`[createMaterial] Materijal kreiran: "${material.naziv}"`, { materialId: material.id, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({ actor: req.session?.user, action: "MATERIAL_CREATED", entity: { type: "Material", id: material.id }, req, success: true });

    return flashAndRedirect(req, res, "success", "Materijal je uspešno otpremljen", `/admin/materijali/detalji/${material.id}`);
  } catch (error) {
    logError("[createMaterial] Greška pri kreiranju materijala", error, { userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 409) {
      return res.status(statusCode).render("admin/_form", {
        pageTitle: "Novi materijal",
        pageDescription: "Otpremi ponudu, brošuru ili drugi fajl",
        data: { ...prepareMaterialFormData(null), errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateMaterial(req, res, next) {
  try {
    const { materialId } = req.params;

    if (req.validationErrors) {
      await discardUpload(req);
      const material = await materialService.getMaterialForEdit(materialId);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${material.title}`,
        pageDescription: material.description,
        data: { ...prepareMaterialFormData(material), errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await materialService.getMaterialForEdit(materialId);
    const updated = await materialService.updateMaterialById(materialId, buildPayload(req, existing), req.uploadedMaterial || null);
    const changes = auditLogService.computeChanges(existing, await materialService.getMaterialForEdit(materialId), ["title", "description", "isActive"]);
    await auditLogService.recordAuditLog({ actor: req.session?.user, action: "MATERIAL_UPDATED", entity: { type: "Material", id: materialId }, changes, req, success: true });

    return flashAndRedirect(req, res, "success", "Materijal je uspešno ažuriran", `/admin/materijali/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateMaterial] Greška pri ažuriranju materijala", error, { materialId: req.params.materialId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
      const material = await materialService.getMaterialForEdit(req.params.materialId).catch(() => null);
      return res.status(statusCode).render("admin/_form", {
        pageTitle: material ? `Izmena - ${material.title}` : "Izmena materijala",
        pageDescription: material?.description || "",
        data: { ...prepareMaterialFormData(material), errors: { general: message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function deleteMaterial(req, res, next) {
  try {
    const { materialId } = req.params;
    await materialService.deleteMaterialById(materialId);
    logInfo(`[deleteMaterial] Materijal #${materialId} obrisan`, { materialId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({ actor: req.session?.user, action: "MATERIAL_DELETED", entity: { type: "Material", id: materialId }, req, success: true });
    return flashAndRedirect(req, res, "success", "Materijal je obrisan", "/admin/materijali");
  } catch (error) {
    logError("[deleteMaterial] Greška pri brisanju materijala", error, { materialId: req.params.materialId, userId: req.session?.user?.id });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) return flashAndRedirect(req, res, "error", message, "/admin/materijali");
    next(error);
  }
}

// printable QR: /admin/materijali/:materialId/qr.svg or .png
export async function qrDownload(req, res, next) {
  try {
    const material = await materialService.getMaterialById(req.params.materialId);
    const url = materialService.buildMaterialUrl(material.slug);
    if (req.params.format === "png") {
      const png = await QRCode.toBuffer(url, { type: "png", margin: 3, errorCorrectionLevel: "M", width: 1200 });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="qr-${material.slug}.png"`);
      return res.send(png);
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 3, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", `attachment; filename="qr-${material.slug}.svg"`);
    return res.send(svg);
  } catch (error) {
    logError("[qrDownload] Greška pri generisanju QR koda materijala", error, { materialId: req.params.materialId, userId: req.session?.user?.id });
    next(error);
  }
}

export default { listMaterials, materialDetails, newMaterialForm, editMaterialForm, createMaterial, updateMaterial, deleteMaterial, qrDownload };
