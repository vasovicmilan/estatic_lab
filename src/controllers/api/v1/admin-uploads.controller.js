import { processUploadForApi, processMultipleUploadsForApi } from "../../../config/multer.config.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";
import { AppError } from "../../../utils/error.util.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import auditLogService from "../../../services/audit-log.service.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Fills the gap docs/*/15-api-v1-reference.md used to call out explicitly: creating/
// editing an entity through /api/v1/admin/* accepts an image/gallery/video field only
// as an already-hosted { img, imgDesc } (or { url, thumbnail, title }) reference, never
// a raw file - see admin-catalog.controller.js's and admin-people.controller.js's header
// comments. This is the endpoint that produces that reference: a client uploads the raw
// file here first, gets the reference back, then includes it in the normal JSON create/
// update call. Reuses the exact same sharp/ffmpeg pipeline multer.config.js already runs
// for the web admin panel (three webp variants for images, a screenshot thumbnail for
// video) - same files on disk, same URL shape, just reached from a JSON endpoint instead
// of a multipart form POST.

// type -> the permission required to upload for that entity. Deliberately the SAME
// permission each entity's own create/update route already requires (see
// admin-catalog.routes.js / admin-taxonomy.routes.js / admin-marketing.routes.js /
// admin-people.routes.js) - an upload is scoped to a resource, so "can I upload an
// image for this?" should never be a broader grant than "can I edit this at all?".
const TYPE_PERMISSIONS = {
  services: "manage_services",
  packages: "manage_packages",
  products: "manage_products",
  categories: "manage_taxonomy",
  posts: "manage_blog",
  testimonials: "manage_marketing",
  experts: "manage_employees",
  partners: "manage_partners",
  // Gap fix: business-partner (admin-marketing.routes.js's /business-partners,
  // permission manage_marketing) needed a coverImage upload the same way every
  // other entity above does, but had no entry here at all - so any "business-partners"
  // upload attempt was rejected up front with "Nepoznat tip uploada" and the
  // admin had no way to satisfy createBusinessPartner's required coverImage field.
  "business-partners": "manage_marketing",
  site: "manage_site_content",
};

// type -> the module gate (feature.middleware.js) the matching entity's own routes
// already sit behind. Not every type has one (categories/tags/testimonials/experts/site
// aren't gated by any single module in the routes files this mirrors) - those pass
// straight through.
const TYPE_MODULES = {
  services: "booking",
  packages: "booking",
  products: "shop",
  posts: "blog",
  partners: "partners",
};

export function requireUploadPermission(req, res, next) {
  const permission = TYPE_PERMISSIONS[req.params.type];
  if (!permission) {
    return next(new AppError(`Nepoznat tip uploada: "${req.params.type}"`, 400, { name: "ValidationError" }));
  }

  const permissions = req.user?.permissions || [];
  if (!permissions.includes(permission)) {
    return next(new AppError("Nemate dozvolu za upload ovog tipa fajla", 403, { name: "AuthorizationError" }));
  }

  next();
}

export function requireUploadModule(req, res, next) {
  const moduleName = TYPE_MODULES[req.params.type];
  if (!moduleName) return next();
  return requireModule(moduleName)(req, res, next);
}

export const uploadSingleMiddleware = processUploadForApi("file");
export const uploadGalleryMiddleware = processMultipleUploadsForApi("gallery", 10);
export const uploadVideoMiddleware = processMultipleUploadsForApi("video", 5);

// FILE_UPLOADED covers every upload shape this endpoint serves (single/gallery/
// video, across every entry in TYPE_PERMISSIONS) with one action name - the raw
// file is uploaded here BEFORE the entity it belongs to is created/updated (see
// this file's header comment), so there is no entity id yet to attach the entry
// to; `entity.type` is the upload's `:type` route param instead (e.g. "services",
// "products"), and `changes` records what was actually produced so the audit
// trail still says something concrete happened, not just "an upload occurred".
export async function uploadFile(req, res, next) {
  try {
    logInfo(`[api/admin/uploadFile] Fajl otpremljen (tip: ${req.params.type})`, { adminId: req.user?.id, type: req.params.type });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "FILE_UPLOADED",
      entity: { type: req.params.type, id: null },
      changes: { field: { old: null, new: "file" }, path: { old: null, new: req.uploadedFile?.img || req.uploadedFile?.url || null } },
    });
    return res.status(201).json({ success: true, data: req.uploadedFile });
  } catch (error) {
    logError("[api/admin/uploadFile] Greška", error, { type: req.params.type });
    next(error);
  }
}

export async function uploadMultiple(req, res, next) {
  try {
    logInfo(`[api/admin/uploadMultiple] ${req.uploadedFiles.length} fajl(ova) otpremljeno (tip: ${req.params.type})`, {
      adminId: req.user?.id,
      type: req.params.type,
    });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "FILE_UPLOADED",
      entity: { type: req.params.type, id: null },
      changes: { field: { old: null, new: "gallery/video" }, count: { old: null, new: req.uploadedFiles?.length || 0 } },
    });
    return res.status(201).json({ success: true, data: req.uploadedFiles });
  } catch (error) {
    logError("[api/admin/uploadMultiple] Greška", error, { type: req.params.type });
    next(error);
  }
}

export default {
  requireUploadPermission,
  requireUploadModule,
  uploadSingleMiddleware,
  uploadGalleryMiddleware,
  uploadVideoMiddleware,
  uploadFile,
  uploadMultiple,
};
