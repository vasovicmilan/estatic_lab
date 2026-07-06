import { Router } from "express";
import * as ServiceController from "../../../controllers/web/admin/catalog/service.controller.js";
import {
  validateServiceStep1,
  validateServicePackagesStep,
  validateServiceExtrasStep,
  validateServiceUpdate,
  validateServiceSeo,
  validateServiceId,
} from "../../../middlewares/validators/service.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const serviceUploads = processMultipleUploads([
  { name: "serviceImage", maxCount: 1, type: "services" },
  { name: "gallery", maxCount: 10, type: "services" },
]);

router.get("/", validateSearch, ServiceController.listServices);
router.get("/detalji/:serviceId", validateServiceId, ServiceController.serviceDetails);
router.get("/izmena/:serviceId", validateServiceId, ServiceController.editServiceForm);
router.get("/:serviceId/seo", validateServiceId, ServiceController.editServiceSeoForm);

// --- 3-phase creation wizard ---
// Phase 1: core info + image (file upload -> needs multer before CSRF)
router.get("/dodavanje", ServiceController.newServiceForm);
router.post(
  "/dodavanje",
  ...serviceUploads,
  csrfAfterMulter,
  validateServiceStep1,
  ServiceController.createServiceDraft
);

// Phase 2: packages/variants (no file upload -> normal CSRF middleware applies)
router.get("/:serviceId/dodavanje/paketi", validateServiceId, ServiceController.newServicePackagesForm);
router.post(
  "/:serviceId/dodavanje/paketi",
  validateServiceId,
  validateServicePackagesStep,
  ServiceController.addServicePackages
);

// Phase 3: extras + publish (no file upload)
router.get("/:serviceId/dodavanje/detalji", validateServiceId, ServiceController.newServiceExtrasForm);
router.post(
  "/:serviceId/dodavanje/detalji",
  validateServiceId,
  validateServiceExtrasStep,
  ServiceController.publishServiceStep
);

// --- existing single-shot edit flow, unchanged ---
router.put(
  "/:serviceId",
  validateServiceId,
  ...serviceUploads,
  csrfAfterMulter,
  validateServiceUpdate,
  ServiceController.updateService
);

router.put("/:serviceId/seo", validateServiceId, validateServiceSeo, ServiceController.updateServiceSeo);

router.delete("/:serviceId", validateServiceId, ServiceController.deleteService);

export default router;