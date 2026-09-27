import { Router } from "express";
import * as AdminCatalogController from "../../../controllers/api/v1/admin-catalog.controller.js";
import { validateServiceStep1, validateServiceUpdate, validateServiceSeo, validateServiceId } from "../../../middlewares/validators/service.validator.js";
import { validatePackageCreate, validatePackageUpdate, validatePackageId } from "../../../middlewares/validators/package.validator.js";
import { validateProductStep1, validateProductUpdate, validateProductSeo, validateProductId } from "../../../middlewares/validators/product.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Services ----
router.get("/services", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), AdminCatalogController.listServices);
router.get("/services/:serviceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceId, handleApiValidationErrors, AdminCatalogController.getService);
// Raw/edit shape - see admin-catalog.controller.js's getServiceForEdit header comment
// for why this is a second endpoint rather than changing getService's response.
router.get("/services/:serviceId/edit", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceId, handleApiValidationErrors, AdminCatalogController.getServiceForEdit);
// Just phase 1's required-field check (name/slug) - packages/features/isActive are
// all optional at create time (see admin-catalog.controller.js's header comment),
// so validateServicePackagesStep/validateServiceExtrasStep (which require packages)
// are deliberately NOT chained here.
router.post("/services", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceStep1, handleApiValidationErrors, AdminCatalogController.createService);
router.put("/services/:serviceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceId, validateServiceUpdate, handleApiValidationErrors, AdminCatalogController.updateService);
router.put("/services/:serviceId/seo", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceId, validateServiceSeo, handleApiValidationErrors, AdminCatalogController.updateServiceSeo);
router.delete("/services/:serviceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_SERVICES), validateServiceId, handleApiValidationErrors, AdminCatalogController.deleteService);

// ---- Packages ---- (packages relate exclusively to services, see docs/*/16 - same "booking" gate as services above)
router.get("/packages", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), AdminCatalogController.listPackages);
router.get("/packages/:packageId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), validatePackageId, handleApiValidationErrors, AdminCatalogController.getPackage);
// Raw/edit shape - see admin-catalog.controller.js's getPackageForEdit header
// comment for why this is a second endpoint rather than changing getPackage's
// response (same reasoning as services/:serviceId/edit above).
router.get("/packages/:packageId/edit", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), validatePackageId, handleApiValidationErrors, AdminCatalogController.getPackageForEdit);
router.post("/packages", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), validatePackageCreate, handleApiValidationErrors, AdminCatalogController.createPackage);
router.put("/packages/:packageId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), validatePackageId, validatePackageUpdate, handleApiValidationErrors, AdminCatalogController.updatePackage);
router.delete("/packages/:packageId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_PACKAGES), validatePackageId, handleApiValidationErrors, AdminCatalogController.deletePackage);

// ---- Products ----
router.get("/products", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), AdminCatalogController.listProducts);
router.get("/products/:productId", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductId, handleApiValidationErrors, AdminCatalogController.getProduct);
// Raw/edit shape - see admin-catalog.controller.js's getProductForEdit header
// comment for why this is a second endpoint rather than changing getProduct's
// response (same reasoning as services/:serviceId/edit and packages/:packageId/edit above).
router.get("/products/:productId/edit", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductId, handleApiValidationErrors, AdminCatalogController.getProductForEdit);
router.post("/products", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductStep1, handleApiValidationErrors, AdminCatalogController.createProduct);
router.put("/products/:productId", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductId, validateProductUpdate, handleApiValidationErrors, AdminCatalogController.updateProduct);
router.put("/products/:productId/seo", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductId, validateProductSeo, handleApiValidationErrors, AdminCatalogController.updateProductSeo);
router.delete("/products/:productId", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), validateProductId, handleApiValidationErrors, AdminCatalogController.deleteProduct);

export default router;
