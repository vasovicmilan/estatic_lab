import { Router } from "express";
import * as PackageController from "../../../controllers/web/admin/catalog/package.controller.js";
import { validatePackageCreate, validatePackageUpdate, validatePackageId } from "../../../middlewares/validators/package.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const packageUploads = processMultipleUploads([
  { name: "packageImage", maxCount: 1, type: "packages" },
  { name: "gallery", maxCount: 10, type: "packages" },
]);

router.get("/", validateSearch, PackageController.listPackages);
router.get("/dodavanje", PackageController.newPackageForm);
router.get("/detalji/:packageId", validatePackageId, PackageController.packageDetails);
router.get("/izmena/:packageId", validatePackageId, PackageController.editPackageForm);

router.post(
  "/",
  ...packageUploads,
  csrfAfterMulter,
  validatePackageCreate,
  PackageController.createPackage
);

router.put(
  "/:packageId",
  validatePackageId,
  ...packageUploads,
  csrfAfterMulter,
  validatePackageUpdate,
  PackageController.updatePackage
);

router.delete("/:packageId", validatePackageId, PackageController.deletePackage);

export default router;
