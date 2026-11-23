import { formatDateTime } from "../utils/date.time.util.js";

export function formatFileSize(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const TYPE_LABELS = {
  "application/pdf": "PDF",
  "image/png": "Slika (PNG)",
  "image/jpeg": "Slika (JPG)",
  "image/webp": "Slika (WEBP)",
};

export function translateMimeType(mimeType) {
  if (TYPE_LABELS[mimeType]) return TYPE_LABELS[mimeType];
  if (/wordprocessingml/.test(mimeType)) return "Word (DOCX)";
  if (/spreadsheetml/.test(mimeType)) return "Excel (XLSX)";
  if (/presentationml/.test(mimeType)) return "PowerPoint (PPTX)";
  return mimeType;
}

export function mapMaterialsForAdminList(materials = []) {
  return materials.filter(Boolean).map((material) => ({
    id: material._id.toString(),
    naziv: material.title,
    slug: material.slug,
    tip: translateMimeType(material.file?.mimeType),
    velicina: formatFileSize(material.file?.size),
    aktivan: material.isActive ? "Da" : "Ne",
    otvaranja: material.viewCount || 0,
    preuzimanja: material.downloadCount || 0,
    kreirano: formatDateTime(material.createdAt),
  }));
}

export function mapMaterialForAdminDetail(material) {
  if (!material) return null;
  return {
    id: material._id.toString(),
    naziv: material.title,
    slug: material.slug,
    opis: material.description || "",
    aktivan: !!material.isActive,
    fajl: {
      naziv: material.file?.originalName,
      tip: translateMimeType(material.file?.mimeType),
      velicina: formatFileSize(material.file?.size),
    },
    otvaranja: material.viewCount || 0,
    preuzimanja: material.downloadCount || 0,
    vreme: { kreiran: formatDateTime(material.createdAt), azuriran: formatDateTime(material.updatedAt) },
  };
}

// public page: only what a visitor should see (no counters, no stored file name)
export function mapMaterialForPublic(material) {
  if (!material) return null;
  return {
    slug: material.slug,
    naslov: material.title,
    opis: material.description || "",
    tip: translateMimeType(material.file?.mimeType),
    velicina: formatFileSize(material.file?.size),
    isImage: /^image\//.test(material.file?.mimeType || ""),
  };
}

export function mapMaterialForEdit(material) {
  if (!material) return null;
  return {
    id: material._id.toString(),
    title: material.title,
    slug: material.slug,
    description: material.description || "",
    isActive: !!material.isActive,
    file: material.file || null,
  };
}

export default { mapMaterialsForAdminList, mapMaterialForAdminDetail, mapMaterialForPublic, mapMaterialForEdit, formatFileSize, translateMimeType };
