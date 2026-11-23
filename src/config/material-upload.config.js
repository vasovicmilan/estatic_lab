import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { AppError } from "../utils/error.util.js";
import { detectMaterialMimeType, MATERIAL_TYPES } from "../utils/file-signature.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_MATERIAL_SIZE = 25 * 1024 * 1024; // 25MB - enough for a brochure, small enough for a phone

// OUTSIDE src/public on purpose (same idea as TUTORIALS_DIR for the video tutorials): express.static
// would hand every file in there out directly, with no download counting and no way to switch a
// material off - and a manual deploy of src/ could overwrite it. Set MATERIALS_DIR to move it
// (e.g. to a folder that is backed up separately).
export function getMaterialsDir() {
  return process.env.MATERIALS_DIR ? path.resolve(process.env.MATERIALS_DIR) : path.resolve(__dirname, "..", "..", "storage", "materials");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MATERIAL_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!MATERIAL_TYPES[ext]) {
      return cb(new AppError("Dozvoljeni formati: PDF, JPG, PNG, WEBP, DOCX, XLSX, PPTX.", 400, { name: "ValidationError" }));
    }
    return cb(null, true);
  },
});

// "ponuda sajam 2026 (final).pdf" -> "ponuda-sajam-2026-final.pdf" - what the visitor's browser saves it as
export function toDownloadName(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  const base =
    path
      .basename(originalName || "", path.extname(originalName || ""))
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "dj")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 80) || "materijal";
  return `${base}${ext}`;
}

export async function saveMaterialBuffer(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  // the bytes have to be what the extension says (the mimetype is only the client's claim)
  const mimeType = detectMaterialMimeType(file.buffer, ext);
  if (!mimeType) {
    throw new AppError("Fajl nije prepoznat kao validan dokument ili slika na osnovu sadržaja.", 400, { name: "ValidationError" });
  }

  const dir = getMaterialsDir();
  await fs.ensureDir(dir);
  const storedName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, storedName), file.buffer);

  return { storedName, originalName: toDownloadName(file.originalname), mimeType, size: file.buffer.length };
}

export async function removeMaterialFile(storedName) {
  if (!storedName) return;
  // storedName is generated here, but is checked to stay inside the folder anyway (defense in depth)
  const dir = getMaterialsDir();
  const target = path.resolve(dir, storedName);
  if (!target.startsWith(dir + path.sep)) return;
  await fs.remove(target).catch(() => {});
}

export function materialFilePath(storedName) {
  const dir = getMaterialsDir();
  const target = path.resolve(dir, storedName);
  return target.startsWith(dir + path.sep) ? target : null;
}

/** multipart middleware: leaves req.uploadedMaterial = { storedName, originalName, mimeType, size } (nothing when no file was sent) */
export function processMaterialUpload(fieldName = "file") {
  return [
    (req, res, next) =>
      upload.single(fieldName)(req, res, (error) => {
        if (error && error.code === "LIMIT_FILE_SIZE") {
          return next(new AppError(`Fajl je prevelik (najviše ${MAX_MATERIAL_SIZE / (1024 * 1024)} MB).`, 400, { name: "ValidationError" }));
        }
        return next(error);
      }),
    async (req, res, next) => {
      try {
        if (!req.file) return next();
        req.uploadedMaterial = await saveMaterialBuffer(req.file);
        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}

export default { processMaterialUpload, getMaterialsDir, saveMaterialBuffer, removeMaterialFile, materialFilePath, toDownloadName };
