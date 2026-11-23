import materialRepo from "../repositories/material.repository.js";
import {
  mapMaterialsForAdminList,
  mapMaterialForAdminDetail,
  mapMaterialForEdit,
  mapMaterialForPublic,
} from "../mappers/material.mapper.js";
import { removeMaterialFile, materialFilePath } from "../config/material-upload.config.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { BUSINESS } from "../config/business.config.js";

/** Public address of a material's page - what the QR code and campaign buttons point at. */
export function buildMaterialUrl(slug) {
  return `${BUSINESS.siteUrl.replace(/\/+$/, "")}/materijali/${slug}`;
}

export async function listMaterials({ search = "", filters = {}, limit = 10, page = 1, sort } = {}) {
  const result = await materialRepo.findMaterials({ search, limit, page, filters, ...(sort ? { sort } : {}) });
  return { data: mapMaterialsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getMaterialById(materialId) {
  if (!materialId) validationError("materialId");
  const material = await materialRepo.findMaterialById(materialId);
  if (!material) notFound("Materijal");
  return mapMaterialForAdminDetail(material);
}

export async function getMaterialForEdit(materialId) {
  if (!materialId) validationError("materialId");
  const material = await materialRepo.findMaterialById(materialId);
  if (!material) notFound("Materijal");
  return mapMaterialForEdit(material);
}

/** { title, slug, url } for the campaign editor's dropdown (active materials only). */
export async function listMaterialOptions() {
  const materials = await materialRepo.findActiveMaterialOptions();
  return materials.map((m) => ({ title: m.title, slug: m.slug, url: `/materijali/${m.slug}` }));
}

export async function createMaterial(data, uploadedFile) {
  if (!data?.title) validationError("title");
  if (!uploadedFile) badRequest("Izaberite fajl za otpremanje.");

  try {
    const slug = await generateUniqueSlug(data.title, (candidate) => materialRepo.materialSlugExists(candidate));
    const created = await materialRepo.createMaterial({
      title: data.title,
      slug,
      description: data.description || "",
      isActive: data.isActive ?? true,
      file: uploadedFile,
    });
    logInfo("Material created", { materialId: created._id.toString(), slug });
    return mapMaterialForAdminDetail(created.toObject());
  } catch (error) {
    // the file is already on disk by the time the document is saved - don't leave it orphaned
    await removeMaterialFile(uploadedFile.storedName);
    throw error;
  }
}

export async function updateMaterialById(materialId, data, uploadedFile = null) {
  if (!materialId) validationError("materialId");
  const existing = await materialRepo.findMaterialById(materialId);
  if (!existing) {
    if (uploadedFile) await removeMaterialFile(uploadedFile.storedName);
    notFound("Materijal");
  }

  // slug is deliberately not editable - printed QR codes and sent campaigns point at it
  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (uploadedFile) patch.file = uploadedFile;

  let updated;
  try {
    updated = await materialRepo.updateMaterialById(materialId, patch);
  } catch (error) {
    if (uploadedFile) await removeMaterialFile(uploadedFile.storedName);
    throw error;
  }

  // the link and the QR stay the same, only the file behind them changes
  if (uploadedFile) await removeMaterialFile(existing.file?.storedName);
  logInfo("Material updated", { materialId, replacedFile: !!uploadedFile });
  return mapMaterialForAdminDetail(updated);
}

export async function deleteMaterialById(materialId) {
  if (!materialId) validationError("materialId");
  const deleted = await materialRepo.deleteMaterialById(materialId);
  if (!deleted) notFound("Materijal");
  await removeMaterialFile(deleted.file?.storedName);
  logInfo("Material deleted", { materialId, slug: deleted.slug });
  return { id: materialId };
}

// ---------------- public ----------------

/** The page behind a QR code / campaign button. Counts the open. */
export async function getPublicMaterial(slug) {
  const material = await materialRepo.findMaterialBySlug(slug);
  if (!material || !material.isActive) notFound("Materijal");
  // a counter must never break the page
  materialRepo.incrementViewCount(material._id).catch(() => {});
  return mapMaterialForPublic(material);
}

/** { filePath, downloadName, mimeType } for the download route. Counts the download. */
export async function getMaterialDownload(slug, { count = true } = {}) {
  const material = await materialRepo.findMaterialBySlug(slug);
  if (!material || !material.isActive) notFound("Materijal");
  const filePath = materialFilePath(material.file.storedName);
  if (!filePath) notFound("Materijal");
  if (count) materialRepo.incrementDownloadCount(material._id).catch(() => {});
  return { filePath, downloadName: material.file.originalName, mimeType: material.file.mimeType };
}

export default {
  buildMaterialUrl,
  listMaterials,
  getMaterialById,
  getMaterialForEdit,
  listMaterialOptions,
  createMaterial,
  updateMaterialById,
  deleteMaterialById,
  getPublicMaterial,
  getMaterialDownload,
};
