import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { logWarn } from "./logger.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PATH = process.env.UPLOAD_PUBLIC_PATH || path.join(__dirname, "..", "public");

/**
 * Deletes a single previously-uploaded file given its public URL (e.g. the value
 * stored in image.img or a gallery item's img field - "/images/products/xyz.webp").
 * Safe to call with null/undefined/external URLs - does nothing in those cases.
 * Never throws: a cleanup failure (permissions, already gone, etc.) is logged as a
 * warning, not surfaced as an error - the record update itself already succeeded and
 * shouldn't be treated as failed just because the old file couldn't be removed.
 */
export async function deleteUploadedFile(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return;
  // only ever delete files inside our own managed upload tree - never an external
  // URL, never anything a path-traversal-style value could point outside PUBLIC_PATH
  if (!publicUrl.startsWith("/images/") && !publicUrl.startsWith("/videos/")) return;

  const normalized = path.normalize(publicUrl);
  if (normalized.includes("..")) return;

  const filePath = path.join(PUBLIC_PATH, normalized);
  try {
    await fs.remove(filePath);
  } catch (error) {
    logWarn("Failed to delete old uploaded file", { publicUrl, error: error.message });
  }
}

export async function deleteUploadedFiles(publicUrls = []) {
  await Promise.all((publicUrls || []).filter(Boolean).map(deleteUploadedFile));
}

export default { deleteUploadedFile, deleteUploadedFiles };