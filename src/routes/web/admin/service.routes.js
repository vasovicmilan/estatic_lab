import { Router } from "express";
import * as ServiceController from "../../../controllers/web/admin/catalog/service.controller.js";
import { validateServiceCreate, validateServiceUpdate, validateServiceSeo, validateServiceId } from "../../../middlewares/validators/service.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const serviceUploads = processMultipleUploads([
  { name: "serviceImage", maxCount: 1, type: "services" },
  { name: "gallery", maxCount: 10, type: "services" },
]);

router.get("/", validateSearch, ServiceController.listServices);
router.get("/dodavanje", ServiceController.newServiceForm);
router.get("/detalji/:serviceId", validateServiceId, ServiceController.serviceDetails);
router.get("/izmena/:serviceId", validateServiceId, ServiceController.editServiceForm);
router.get("/:serviceId/seo", validateServiceId, ServiceController.editServiceSeoForm);

router.post(
  "/",
  ...serviceUploads,
  csrfAfterMulter,
  validateServiceCreate,
  ServiceController.createService
);

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
