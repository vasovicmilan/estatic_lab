import { Router } from "express";
import * as AdminTaxonomyController from "../../../controllers/api/v1/admin-taxonomy.controller.js";
import { validateRoleCreate, validateRoleUpdate, validateRoleId } from "../../../middlewares/validators/role.validator.js";
import { validateCategoryCreate, validateCategoryUpdate, validateCategoryId } from "../../../middlewares/validators/category.validator.js";
import { validateTagCreate, validateTagUpdate, validateTagId } from "../../../middlewares/validators/tag.validator.js";
import { validateResourceCreate, validateResourceUpdate, validateResourceId } from "../../../middlewares/validators/resource.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Roles ---- (not module-specific - a role/permission exists regardless of which modules are enabled)
router.get("/roles", requirePermission(PERMISSION.MANAGE_ROLES), AdminTaxonomyController.listRoles);
router.get("/roles/:roleId", requirePermission(PERMISSION.MANAGE_ROLES), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.getRole);
router.post("/roles", requirePermission(PERMISSION.MANAGE_ROLES), validateRoleCreate, handleApiValidationErrors, AdminTaxonomyController.createRole);
router.put("/roles/:roleId", requirePermission(PERMISSION.MANAGE_ROLES), validateRoleId, validateRoleUpdate, handleApiValidationErrors, AdminTaxonomyController.updateRole);
router.delete("/roles/:roleId", requirePermission(PERMISSION.MANAGE_ROLES), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.deleteRole);

// ---- Categories ---- (NOT module-gated - a category is polymorphic across
// blog/service/product domains via its own `domain` field, see
// category.service.js's getCategoryAndDescendantIds; this single CRUD screen
// manages categories for whichever domains ARE enabled, so gating the whole
// route would hide it even for a still-enabled domain)
router.get("/categories", requirePermission(PERMISSION.MANAGE_TAXONOMY), AdminTaxonomyController.listCategories);
router.get("/categories/:categoryId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.getCategory);
// Raw/edit shape - see admin-taxonomy.controller.js's getCategoryForEdit header
// comment for why this is a second endpoint rather than changing getCategory's
// response (same reasoning as admin-catalog.routes.js's :id/edit routes).
router.get("/categories/:categoryId/edit", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.getCategoryForEdit);
router.post("/categories", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateCategoryCreate, handleApiValidationErrors, AdminTaxonomyController.createCategory);
router.put("/categories/:categoryId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateCategoryId, validateCategoryUpdate, handleApiValidationErrors, AdminTaxonomyController.updateCategory);
router.delete("/categories/:categoryId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.deleteCategory);

// ---- Tags ---- (same reasoning as Categories above - polymorphic across domains)
router.get("/tags", requirePermission(PERMISSION.MANAGE_TAXONOMY), AdminTaxonomyController.listTags);
router.get("/tags/:tagId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateTagId, handleApiValidationErrors, AdminTaxonomyController.getTag);
router.get("/tags/:tagId/edit", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateTagId, handleApiValidationErrors, AdminTaxonomyController.getTagForEdit);
router.post("/tags", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateTagCreate, handleApiValidationErrors, AdminTaxonomyController.createTag);
router.put("/tags/:tagId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateTagId, validateTagUpdate, handleApiValidationErrors, AdminTaxonomyController.updateTag);
router.delete("/tags/:tagId", requirePermission(PERMISSION.MANAGE_TAXONOMY), validateTagId, handleApiValidationErrors, AdminTaxonomyController.deleteTag);

// ---- Resources ---- (rooms/equipment/tables used for appointments - booking-only)
router.get("/resources", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), AdminTaxonomyController.listResources);
router.get("/resources/:resourceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.getResource);
router.get("/resources/:resourceId/edit", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.getResourceForEdit);
router.post("/resources", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), validateResourceCreate, handleApiValidationErrors, AdminTaxonomyController.createResource);
router.put("/resources/:resourceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), validateResourceId, validateResourceUpdate, handleApiValidationErrors, AdminTaxonomyController.updateResource);
router.delete("/resources/:resourceId", requireModule("booking"), requirePermission(PERMISSION.MANAGE_RESOURCES), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.deleteResource);

export default router;
