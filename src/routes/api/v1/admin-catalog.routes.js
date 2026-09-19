import { Router } from "express";
import * as AdminCatalogController from "../../../controllers/api/v1/admin-catalog.controller.js";
import { validateServiceStep1, validateServiceUpdate, validateServiceSeo, validateServiceId } from "../../../middlewares/validators/service.validator.js";
import { validatePackageCreate, validatePackageUpdate, validatePackageId } from "../../../middlewares/validators/package.validator.js";
import { validateProductStep1, validateProductUpdate, validateProductSeo, validateProductId } from "../../../middlewares/validators/product.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Services ----
router.get("/services", requireModule("booking"), requirePermission("manage_services"), AdminCatalogController.listServices);
router.get("/services/:serviceId", requireModule("booking"), requirePermission("manage_services"), validateServiceId, handleApiValidationErrors, AdminCatalogController.getService);
// Just phase 1's required-field check (name/slug) - packages/features/isActive are
// all optional at create time (see admin-catalog.controller.js's header comment),
// so validateServicePackagesStep/validateServiceExtrasStep (which require packages)
// are deliberately NOT chained here.
router.post("/services", requireModule("booking"), requirePermission("manage_services"), validateServiceStep1, handleApiValidationErrors, AdminCatalogController.createService);
router.put("/services/:serviceId", requireModule("booking"), requirePermission("manage_services"), validateServiceId, validateServiceUpdate, handleApiValidationErrors, AdminCatalogController.updateService);
router.put("/services/:serviceId/seo", requireModule("booking"), requirePermission("manage_services"), validateServiceId, validateServiceSeo, handleApiValidationErrors, AdminCatalogController.updateServiceSeo);
router.delete("/services/:serviceId", requireModule("booking"), requirePermission("manage_services"), validateServiceId, handleApiValidationErrors, AdminCatalogController.deleteService);

// ---- Packages ---- (packages relate exclusively to services, see docs/*/16 - same "booking" gate as services above)
router.get("/packages", requireModule("booking"), requirePermission("manage_packages"), AdminCatalogController.listPackages);
router.get("/packages/:packageId", requireModule("booking"), requirePermission("manage_packages"), validatePackageId, handleApiValidationErrors, AdminCatalogController.getPackage);
router.post("/packages", requireModule("booking"), requirePermission("manage_packages"), validatePackageCreate, handleApiValidationErrors, AdminCatalogController.createPackage);
router.put("/packages/:packageId", requireModule("booking"), requirePermission("manage_packages"), validatePackageId, validatePackageUpdate, handleApiValidationErrors, AdminCatalogController.updatePackage);
router.delete("/packages/:packageId", requireModule("booking"), requirePermission("manage_packages"), validatePackageId, handleApiValidationErrors, AdminCatalogController.deletePackage);

// ---- Products ----
router.get("/products", requireModule("shop"), requirePermission("manage_products"), AdminCatalogController.listProducts);
router.get("/products/:productId", requireModule("shop"), requirePermission("manage_products"), validateProductId, handleApiValidationErrors, AdminCatalogController.getProduct);
router.post("/products", requireModule("shop"), requirePermission("manage_products"), validateProductStep1, handleApiValidationErrors, AdminCatalogController.createProduct);
router.put("/products/:productId", requireModule("shop"), requirePermission("manage_products"), validateProductId, validateProductUpdate, handleApiValidationErrors, AdminCatalogController.updateProduct);
router.put("/products/:productId/seo", requireModule("shop"), requirePermission("manage_products"), validateProductId, validateProductSeo, handleApiValidationErrors, AdminCatalogController.updateProductSeo);
router.delete("/products/:productId", requireModule("shop"), requirePermission("manage_products"), validateProductId, handleApiValidationErrors, AdminCatalogController.deleteProduct);

export default router;
