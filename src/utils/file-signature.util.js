// Magic-byte sniffing for uploaded "material" files (PDF / images / Office documents).
//
// Same reasoning as video-signature.util.js: `file.mimetype` is whatever the uploading client
// claims, so it proves nothing. The first bytes of the file are checked instead, and the
// extension has to agree with them - a renamed .html/.exe never gets stored.
//
// Office files (docx/xlsx/pptx) are ZIP containers, so their signature is the ZIP one; the
// extension decides which of the three it is (they are only ever offered for download, never
// opened by the server).

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// extension -> mime type served on download
export const MATERIAL_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const startsWith = (buffer, magic) => buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);

function looksLikeWebp(buffer) {
  return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

/**
 * Returns the mime type for `ext` (lower-case, with the dot) if the buffer's own bytes really
 * are that kind of file, otherwise null.
 */
export function detectMaterialMimeType(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  const expected = MATERIAL_TYPES[ext];
  if (!expected) return null;

  switch (ext) {
    case ".pdf":
      return startsWith(buffer, PDF_MAGIC) ? expected : null;
    case ".png":
      return startsWith(buffer, PNG_MAGIC) ? expected : null;
    case ".jpg":
    case ".jpeg":
      return startsWith(buffer, JPEG_MAGIC) ? expected : null;
    case ".webp":
      return looksLikeWebp(buffer) ? expected : null;
    case ".docx":
    case ".xlsx":
    case ".pptx":
      return startsWith(buffer, ZIP_MAGIC) ? expected : null;
    default:
      return null;
  }
}

export default { detectMaterialMimeType, MATERIAL_TYPES };
