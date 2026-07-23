import { Router } from "express";
import * as PackagePurchaseController from "../../../controllers/web/admin/catalog/package-purchase.controller.js";
import {
  validateCreatePackagePurchase,
  validateUpdatePackagePurchase,
  validatePackagePurchaseId,
} from "../../../middlewares/validators/package-purchase.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, PackagePurchaseController.listPackagePurchases);
router.get("/dodavanje", PackagePurchaseController.newPackagePurchaseForm);
router.get("/izmena/:packagePurchaseId", validatePackagePurchaseId, PackagePurchaseController.editPackagePurchaseForm);
router.get("/detalji/:packagePurchaseId", validatePackagePurchaseId, PackagePurchaseController.packagePurchaseDetails);

router.post("/proveri-kupon", PackagePurchaseController.checkPackagePurchaseCoupon);
router.post("/", validateCreatePackagePurchase, PackagePurchaseController.createPackagePurchase);

router.put("/:packagePurchaseId", validatePackagePurchaseId, validateUpdatePackagePurchase, PackagePurchaseController.updatePackagePurchase);
router.put("/:packagePurchaseId/otkazi", validatePackagePurchaseId, PackagePurchaseController.cancelPackagePurchase);

router.delete("/:packagePurchaseId", validatePackagePurchaseId, PackagePurchaseController.deletePackagePurchase);

export default router;