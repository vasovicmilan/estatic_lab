import * as materialService from "../../../services/material.service.js";
import { removeMaterialFile } from "../../../config/material-upload.config.js";
import auditLogService from "../../../services/audit-log.service.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";
import { ValidationError } from "../../../utils/error.util.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { parseCheckbox } from "../../../utils/form-bool.util.js";
import { resolveAdminLimit } from "../../../utils/pagination.util.js";

// Fajl se šalje kao multipart (polje "file"; PDF, slika, dokument do 25 MB), ostala polja su
// title, description, isActive. Kad poziva API token (Claude asistent), isActive je uvek false:
// materijal postaje javan tek kad ga vlasnik aktivira u /admin/materijali.
function payload(req, existing = {}) {
  const forcedDraft = req.user?.via === "api-token" || req.apiTokenDraft === "active";
  return {
    title: req.body.title,
    description: req.body.description ?? undefined,
    isActive: forcedDraft ? false : parseCheckbox(req.body.isActive, existing.isActive ?? true),
  };
}

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
    });
    return res.json({ success: true, data: result.data, pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (error) {
    next(error);
  }
}

export async function getMaterial(req, res, next) {
  try {
    return res.json({ success: true, data: await materialService.getMaterialById(req.params.materialId) });
  } catch (error) {
    next(error);
  }
}

export async function getMaterialForEdit(req, res, next) {
  try {
    return res.json({ success: true, data: await materialService.getMaterialForEdit(req.params.materialId) });
  } catch (error) {
    next(error);
  }
}

export async function createMaterial(req, res, next) {
  try {
    if (req.validationErrors) {
      await discardUpload(req);
      return next(new ValidationError("Validacija nije uspela", req.validationErrors));
    }
    const material = await materialService.createMaterial(payload(req), req.uploadedMaterial);
    logInfo(`[api/admin/createMaterial] Materijal kreiran: "${material.naziv}"`, { materialId: material.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "MATERIAL_CREATED", entity: { type: "Material", id: material.id } });
    return res.status(201).json({ success: true, data: material });
  } catch (error) {
    await discardUpload(req).catch(() => {});
    logError("[api/admin/createMaterial] Greška", error);
    next(error);
  }
}

export async function updateMaterial(req, res, next) {
  try {
    const { materialId } = req.params;
    if (req.validationErrors) {
      await discardUpload(req);
      return next(new ValidationError("Validacija nije uspela", req.validationErrors));
    }
    const existing = await materialService.getMaterialForEdit(materialId);
    const updated = await materialService.updateMaterialById(materialId, payload(req, existing), req.uploadedMaterial || null);
    const changes = auditLogService.computeChanges(existing, await materialService.getMaterialForEdit(materialId), ["title", "description", "isActive"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "MATERIAL_UPDATED", entity: { type: "Material", id: materialId }, changes });
    return res.json({ success: true, data: updated });
  } catch (error) {
    await discardUpload(req).catch(() => {});
    logError("[api/admin/updateMaterial] Greška", error, { materialId: req.params.materialId });
    next(error);
  }
}

export default { listMaterials, getMaterial, getMaterialForEdit, createMaterial, updateMaterial };
