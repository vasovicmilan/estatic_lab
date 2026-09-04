function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

/**
 * Rebuilds the gallery array from the media-management form submission:
 * - existing images round-trip as parallel arrays (img URL + alt text),
 *   since ImageSchema entries have no _id to key off - index position is
 *   how we match a checked "remove" box back to the right image.
 * - newly uploaded files (req.uploadedFiles.gallery) get appended, each
 *   paired by index with its own newGalleryDesc[] entry (see
 *   admin-gallery-uploader.js) - one file input + one description input per
 *   row, both keep DOM order through multer/busboy's multipart parsing, so
 *   zipping them by index lines the right description up with the right
 *   image. A missing description (row submitted blank) just falls back to "".
 */
export function buildGalleryPayload(req) {
  const existingImg = toArray(req.body.existingGalleryImg);
  const existingDesc = toArray(req.body.existingGalleryDesc);
  const removeIndexes = new Set(toArray(req.body.removeGallery).map(Number));

  const kept = existingImg
    .map((img, i) => ({ img, imgDesc: existingDesc[i] || "" }))
    .filter((_, i) => !removeIndexes.has(i));

  const newDescs = toArray(req.body.newGalleryDesc);
  const newlyUploaded = toArray(req.uploadedFiles?.gallery).map((f, i) => ({
    img: f.img,
    imgDesc: (newDescs[i] || "").trim(),
  }));

  return [...kept, ...newlyUploaded];
}

/**
 * Rebuilds the videos array: existing/edited external videos come through
 * the JSON repeater as req.body.videos (already an array - parseJsonFields
 * must run before this), and any newly uploaded self-hosted video files
 * (req.uploadedFiles.video, processed+thumbnailed by multer.config.js) get
 * appended as isExternal: false entries.
 */
export function buildVideosPayload(req) {
  const fromForm = Array.isArray(req.body.videos) ? req.body.videos : [];
  const normalized = fromForm
    .filter((v) => v && v.url)
    .map((v) => ({
      url: v.url,
      title: v.title || "",
      thumbnail: v.thumbnail || "",
      isExternal: v.isExternal === "true" || v.isExternal === true || v.isExternal === "on",
    }));

  const newlyUploaded = toArray(req.uploadedFiles?.video).map((v) => ({
    url: v.url,
    title: v.title || "",
    thumbnail: v.thumbnail || "",
    isExternal: false,
  }));

  return [...normalized, ...newlyUploaded];
}

export default { buildGalleryPayload, buildVideosPayload };