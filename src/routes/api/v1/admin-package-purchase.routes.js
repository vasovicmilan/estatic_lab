import { Router } from "express";
import * as AdminPackagePurchaseController from "../../../controllers/api/v1/admin-package-purchase.controller.js";
import {
  validateCreatePackagePurchase,
  validateUpdatePackagePurchase,
  validatePackagePurchaseId,
} from "../../../middlewares/validators/package-purchase.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

// Mounted at /admin/package-purchases (see index.routes.js) - same permission
// ("manage_packages") as the web equivalent at /admin/kupljeni-paketi, since a
// purchased package is managed alongside the packages themselves.

const router = Router();
router.use(apiAuthMiddleware, requirePermission("manage_packages"));

router.get("/", AdminPackagePurchaseController.listPackagePurchases);
router.get("/:packagePurchaseId", validatePackagePurchaseId, handleApiValidationErrors, AdminPackagePurchaseController.getPackagePurchase);

router.post("/check-coupon", AdminPackagePurchaseController.checkPackagePurchaseCoupon);
router.post("/", validateCreatePackagePurchase, handleApiValidationErrors, AdminPackagePurchaseController.createPackagePurchase);

router.put("/:packagePurchaseId", validatePackagePurchaseId, validateUpdatePackagePurchase, handleApiValidationErrors, AdminPackagePurchaseController.updatePackagePurchase);
router.put("/:packagePurchaseId/cancel", validatePackagePurchaseId, handleApiValidationErrors, AdminPackagePurchaseController.cancelPackagePurchase);

router.delete("/:packagePurchaseId", validatePackagePurchaseId, handleApiValidationErrors, AdminPackagePurchaseController.deletePackagePurchase);

export default router;
