import { Router } from "express";
import * as ResourceController from "../../../controllers/web/admin/catalog/resource.controller.js";
import { validateResourceCreate, validateResourceUpdate, validateResourceId } from "../../../middlewares/validators/resource.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, ResourceController.listResources);
router.get("/dodavanje", ResourceController.newResourceForm);
router.get("/detalji/:resourceId", validateResourceId, ResourceController.resourceDetails);
router.get("/izmena/:resourceId", validateResourceId, ResourceController.editResourceForm);

router.post("/", validateResourceCreate, ResourceController.createResource);

router.put("/:resourceId", validateResourceId, validateResourceUpdate, ResourceController.updateResource);

router.delete("/:resourceId", validateResourceId, ResourceController.deleteResource);

export default router;