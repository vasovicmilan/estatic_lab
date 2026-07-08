import { Router } from "express";
import * as PackagePurchaseController from "../../../controllers/web/admin/catalog/package-purchase.controller.js";
import { validateCreatePackagePurchase, validatePackagePurchaseId } from "../../../middlewares/validators/package-purchase.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, PackagePurchaseController.listPackagePurchases);
router.get("/dodavanje", PackagePurchaseController.newPackagePurchaseForm);
router.get("/detalji/:packagePurchaseId", validatePackagePurchaseId, PackagePurchaseController.packagePurchaseDetails);

router.post("/", validateCreatePackagePurchase, PackagePurchaseController.createPackagePurchase);

router.put("/:packagePurchaseId/otkazi", validatePackagePurchaseId, PackagePurchaseController.cancelPackagePurchase);

export default router;