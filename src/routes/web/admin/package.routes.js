import { Router } from "express";
import * as PackageController from "../../../controllers/web/admin/catalog/package.controller.js";
import { validatePackageCreate, validatePackageUpdate, validatePackageId } from "../../../middlewares/validators/package.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { validateMediaUpdate } from "../../../middlewares/validators/media.validator.js";
import { parseJsonFields } from "../../../middlewares/parse-json-fields.middleware.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const packageUploads = processMultipleUploads([
  { name: "packageImage", maxCount: 1, type: "packages" },
  { name: "gallery", maxCount: 10, type: "packages" },
]);

const packageGalleryUploads = processMultipleUploads([
  { name: "gallery", maxCount: 10, type: "packages" },
  { name: "video", maxCount: 5, type: "packages" },
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

// --- gallery & video, managed separately from the main edit form ---
router.get("/:packageId/galerija", validatePackageId, PackageController.editPackageGalleryForm);
router.put(
  "/:packageId/galerija",
  validatePackageId,
  ...packageGalleryUploads,
  csrfAfterMulter,
  parseJsonFields("videos"),
  validateMediaUpdate,
  PackageController.updatePackageGallery
);

router.delete("/:packageId", validatePackageId, PackageController.deletePackage);

export default router;