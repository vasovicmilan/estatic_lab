import auditLogService from "../../../services/audit-log.service.js";
import postService from "../../../services/post.service.js";
import serviceService from "../../../services/service.service.js";
import packageService from "../../../services/package.service.js";
import productService from "../../../services/product.service.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";
import { logInfo, logError } from "../../../utils/logger.util.js";
import { normalizeError } from "../../../utils/error.util.js";

/**
 * Reversible alternative to deleting, for roles that may not hard-delete.
 * Blog posts become "archived"; services / packages / products become inactive.
 * The record, its history and its links all stay; the admin can restore it from the edit form.
 */
function makeSoftRemove({ param, baseUrl, label, entityType, auditAction, successMessage, apply, read }) {
  return async function softRemove(req, res, next) {
    const id = req.params[param];
    try {
      const existing = await read(id).catch(() => null);
      await apply(id);
      logInfo(`[${auditAction}] ${label} #${id}`, { id, userId: req.session?.user?.id });
      await auditLogService.recordAuditLog({
        actor: req.session?.user,
        action: auditAction,
        entity: { type: entityType, id },
        changes: { naziv: { old: existing?.naziv || null, new: existing?.naziv || null } },
        req,
        success: true,
      });
      return flashAndRedirect(req, res, "success", successMessage, baseUrl);
    } catch (error) {
      logError(`[${auditAction}] Greška`, error, { id, userId: req.session?.user?.id });
      const { statusCode, message } = normalizeError(error);
      if (statusCode) return flashAndRedirect(req, res, "error", message, baseUrl);
      next(error);
    }
  };
}

export const archivePost = makeSoftRemove({
  param: "postId",
  baseUrl: "/admin/blog",
  label: "Post arhiviran",
  entityType: "Post",
  auditAction: "POST_ARCHIVED",
  successMessage: "Članak je arhiviran. Admin ga može vratiti u nacrt.",
  apply: (id) => postService.updatePostStatus(id, "archived"),
  read: (id) => postService.getPostById(id),
});

export const deactivateService = makeSoftRemove({
  param: "serviceId",
  baseUrl: "/admin/usluge",
  label: "Usluga deaktivirana",
  entityType: "Service",
  auditAction: "SERVICE_DEACTIVATED",
  successMessage: "Usluga je deaktivirana i više nije vidljiva na sajtu.",
  apply: (id) => serviceService.updateServiceById(id, { isActive: false }),
  read: (id) => serviceService.getServiceById(id),
});

export const deactivatePackage = makeSoftRemove({
  param: "packageId",
  baseUrl: "/admin/paketi",
  label: "Paket deaktiviran",
  entityType: "Package",
  auditAction: "PACKAGE_DEACTIVATED",
  successMessage: "Paket je deaktiviran i više nije vidljiv na sajtu.",
  apply: (id) => packageService.updatePackageById(id, { isActive: false }),
  read: (id) => packageService.getPackageById(id),
});

export const deactivateProduct = makeSoftRemove({
  param: "productId",
  baseUrl: "/admin/proizvodi",
  label: "Proizvod deaktiviran",
  entityType: "Product",
  auditAction: "PRODUCT_DEACTIVATED",
  successMessage: "Proizvod je deaktiviran i više nije vidljiv u prodavnici.",
  apply: (id) => productService.updateProductById(id, { isActive: false }),
  read: (id) => productService.getProductById(id),
});

export default { archivePost, deactivateService, deactivatePackage, deactivateProduct };
