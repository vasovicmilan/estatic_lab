// Magic-byte (file-signature) sniffing for uploaded video buffers.
//
// multer.config.js's fileFilter only ever checked `file.mimetype`, which is a
// value the UPLOADING CLIENT sends in the multipart request and can set to
// anything it likes (e.g. rename a .php/.html/.exe payload to "clip.mp4" and
// send "Content-Type: video/mp4"). That made the mimetype check purely
// cosmetic as a security gate - it stops nothing, it just changes what error
// message a non-video upload gets.
//
// This module instead looks at the FIRST BYTES OF THE FILE ITSELF (the file
// signature / "magic bytes"), which the uploader does not control merely by
// relabeling the request - producing bytes that pass this check means
// actually constructing a well-formed MP4/WebM container header.
//
// No new dependency: package.json has no file-type/magic-byte library
// installed already (checked before writing this), and the two formats this
// app allows (ALLOWED_VIDEO_TYPES in multer.config.js: video/mp4, video/webm)
// have short, simple, well-documented signatures, so a small hand-rolled
// check is a smaller footprint than pulling in a new package for two formats.
//
// MP4 (ISO Base Media File Format, which webm is NOT a variant of): the file
// starts with a 4-byte big-endian box size, then the 4-byte ASCII box type.
// A conforming MP4 always opens with an "ftyp" box (the file-type box), so
// bytes [4..8) read "ftyp" - this holds for every real-world MP4/MOV/M4V
// encoder (browsers' MediaRecorder, ffmpeg, phone cameras, editing software).
//
// WebM (Matroska/EBML container): every EBML stream starts with the fixed
// 4-byte EBML magic number 0x1A45DFA3.
const MP4_FTYP_OFFSET = 4;
const MP4_FTYP_ASCII = "ftyp";
const WEBM_EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

function looksLikeMp4(buffer) {
  if (buffer.length < MP4_FTYP_OFFSET + MP4_FTYP_ASCII.length) return false;
  return buffer.toString("ascii", MP4_FTYP_OFFSET, MP4_FTYP_OFFSET + MP4_FTYP_ASCII.length) === MP4_FTYP_ASCII;
}

function looksLikeWebm(buffer) {
  if (buffer.length < WEBM_EBML_MAGIC.length) return false;
  return buffer.subarray(0, WEBM_EBML_MAGIC.length).equals(WEBM_EBML_MAGIC);
}

// Inspects the actual bytes and returns the real mimetype the content
// matches ("video/mp4" | "video/webm"), or null if the buffer doesn't match
// any signature this app recognizes as video - regardless of what mimetype
// the client claimed.
export function detectVideoMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (looksLikeMp4(buffer)) return "video/mp4";
  if (looksLikeWebm(buffer)) return "video/webm";
  return null;
}

// True only if the buffer's REAL, sniffed content type is one of the
// caller-supplied allowed types - never consults file.mimetype.
export function isAllowedVideoBuffer(buffer, allowedTypes) {
  const detected = detectVideoMimeType(buffer);
  return detected !== null && allowedTypes.includes(detected);
}

export default { detectVideoMimeType, isAllowedVideoBuffer };
