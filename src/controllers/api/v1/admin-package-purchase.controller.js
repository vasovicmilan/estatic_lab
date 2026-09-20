import packagePurchaseService from "../../../services/package-purchase.service.js";
import * as packageService from "../../../services/package.service.js";
import couponService from "../../../services/coupon.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Mirrors controllers/web/admin/catalog/package-purchase.controller.js - same
// service, same audit log actions/entity type. Returns raw service data rather
// than routing through the HTML presenters, same reasoning as the other API v1
// admin controllers.

export async function listPackagePurchases(req, res, next) {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;
    const result = await packagePurchaseService.listPurchases({
      filters: { userId: userId || undefined, status: status || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listPackagePurchases] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPackagePurchase(req, res, next) {
  try {
    const purchase = await packagePurchaseService.getPurchaseById(req.params.packagePurchaseId);
    return res.json({ success: true, data: purchase });
  } catch (error) {
    logError("[api/admin/getPackagePurchase] Greška", error, { packagePurchaseId: req.params.packagePurchaseId });
    next(error);
  }
}

export async function createPackagePurchase(req, res, next) {
  try {
    const { userId, packageId, expiresAt, pricePaid, couponCode, notes } = req.body;
    const purchase = await packagePurchaseService.createPurchaseForUser(userId, packageId, req.user.id, {
      expiresAt: expiresAt || null,
      pricePaid: pricePaid != null ? Number(pricePaid) : null,
      couponCode: couponCode || null,
      notes: notes || "",
    });

    logInfo(`[api/admin/createPackagePurchase] Paket dodeljen korisniku #${userId}`, { packagePurchaseId: purchase.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "PACKAGE_PURCHASE_CREATED",
      entity: { type: "PackagePurchase", id: purchase.id },
      changes: {
        userId: { old: null, new: userId },
        packageId: { old: null, new: packageId },
        pricePaid: { old: null, new: pricePaid != null ? Number(pricePaid) : null },
        couponCode: { old: null, new: couponCode || null },
      },
    });

    return res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    logError("[api/admin/createPackagePurchase] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updatePackagePurchase(req, res, next) {
  try {
    const { packagePurchaseId } = req.params;
    const { expiresAt, notes } = req.body;
    const existing = await packagePurchaseService.getPurchaseById(packagePurchaseId);
    const updated = await packagePurchaseService.updatePurchase(packagePurchaseId, { expiresAt: expiresAt || null, notes });
    logInfo(`[api/admin/updatePackagePurchase] Kupljeni paket #${packagePurchaseId} ažuriran`, { packagePurchaseId, adminId: req.user.id });

    const changes = auditLogService.computeChanges(existing, updated, ["expiresAtRaw", "napomena"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PACKAGE_PURCHASE_UPDATED", entity: { type: "PackagePurchase", id: packagePurchaseId }, changes });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updatePackagePurchase] Greška", error, { packagePurchaseId: req.params.packagePurchaseId, body: req.body });
    next(error);
  }
}

export async function cancelPackagePurchase(req, res, next) {
  try {
    const { packagePurchaseId } = req.params;
    const updated = await packagePurchaseService.cancelPurchase(packagePurchaseId, req.user.id);
    logInfo(`[api/admin/cancelPackagePurchase] Kupljeni paket #${packagePurchaseId} otkazan`, { packagePurchaseId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "PACKAGE_PURCHASE_CANCELLED",
      entity: { type: "PackagePurchase", id: packagePurchaseId },
      changes: { status: { old: null, new: "cancelled" } },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/cancelPackagePurchase] Greška", error, { packagePurchaseId: req.params.packagePurchaseId });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req, { success: false, errorMessage: error.message }),
      action: "PACKAGE_PURCHASE_CANCELLED",
      entity: { type: "PackagePurchase", id: req.params.packagePurchaseId },
    });
    next(error);
  }
}

export async function deletePackagePurchase(req, res, next) {
  try {
    const { packagePurchaseId } = req.params;
    await packagePurchaseService.deletePurchase(packagePurchaseId, req.user.id);
    logInfo(`[api/admin/deletePackagePurchase] Kupljeni paket #${packagePurchaseId} obrisan`, { packagePurchaseId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PACKAGE_PURCHASE_DELETED", entity: { type: "PackagePurchase", id: packagePurchaseId } });
    return res.json({ success: true, data: { message: "Kupljeni paket je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deletePackagePurchase] Greška", error, { packagePurchaseId: req.params.packagePurchaseId });
    next(error);
  }
}

/**
 * Read-only coupon preview for the create form - same as
 * package-purchase.controller.js's checkPackagePurchaseCoupon. Does NOT redeem
 * the coupon (that only happens inside createPurchaseForUser's transaction).
 */
export async function checkPackagePurchaseCoupon(req, res) {
  try {
    const { code, packageId, userId } = req.body;
    if (!code || !packageId) {
      return res.status(400).json({ success: false, error: { message: "Kod kupona i paket su obavezni" } });
    }

    const pkg = await packageService.getPackageByIdRaw(packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, error: { message: "Paket nije pronađen" } });
    }

    const { discountAmount } = await couponService.validateCouponForPackagePurchase(code, {
      userId: userId || null,
      packageId,
      purchaseValue: pkg.totalPrice,
    });

    return res.json({
      success: true,
      data: { originalPrice: pkg.totalPrice, discountAmount, finalPrice: Math.max(0, pkg.totalPrice - discountAmount) },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, error: { message: error.message || "Kupon nije važeći" } });
  }
}

export default {
  listPackagePurchases,
  getPackagePurchase,
  createPackagePurchase,
  updatePackagePurchase,
  cancelPackagePurchase,
  deletePackagePurchase,
  checkPackagePurchaseCoupon,
};
