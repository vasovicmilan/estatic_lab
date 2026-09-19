import { Router } from "express";
import * as AdminTaxonomyController from "../../../controllers/api/v1/admin-taxonomy.controller.js";
import { validateRoleCreate, validateRoleUpdate, validateRoleId } from "../../../middlewares/validators/role.validator.js";
import { validateCategoryCreate, validateCategoryUpdate, validateCategoryId } from "../../../middlewares/validators/category.validator.js";
import { validateTagCreate, validateTagUpdate, validateTagId } from "../../../middlewares/validators/tag.validator.js";
import { validateResourceCreate, validateResourceUpdate, validateResourceId } from "../../../middlewares/validators/resource.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Roles ---- (not module-specific - a role/permission exists regardless of which modules are enabled)
router.get("/roles", requirePermission("manage_roles"), AdminTaxonomyController.listRoles);
router.get("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.getRole);
router.post("/roles", requirePermission("manage_roles"), validateRoleCreate, handleApiValidationErrors, AdminTaxonomyController.createRole);
router.put("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, validateRoleUpdate, handleApiValidationErrors, AdminTaxonomyController.updateRole);
router.delete("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.deleteRole);

// ---- Categories ---- (NOT module-gated - a category is polymorphic across
// blog/service/product domains via its own `domain` field, see
// category.service.js's getCategoryAndDescendantIds; this single CRUD screen
// manages categories for whichever domains ARE enabled, so gating the whole
// route would hide it even for a still-enabled domain)
router.get("/categories", requirePermission("manage_taxonomy"), AdminTaxonomyController.listCategories);
router.get("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.getCategory);
router.post("/categories", requirePermission("manage_taxonomy"), validateCategoryCreate, handleApiValidationErrors, AdminTaxonomyController.createCategory);
router.put("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, validateCategoryUpdate, handleApiValidationErrors, AdminTaxonomyController.updateCategory);
router.delete("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.deleteCategory);

// ---- Tags ---- (same reasoning as Categories above - polymorphic across domains)
router.get("/tags", requirePermission("manage_taxonomy"), AdminTaxonomyController.listTags);
router.get("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, handleApiValidationErrors, AdminTaxonomyController.getTag);
router.post("/tags", requirePermission("manage_taxonomy"), validateTagCreate, handleApiValidationErrors, AdminTaxonomyController.createTag);
router.put("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, validateTagUpdate, handleApiValidationErrors, AdminTaxonomyController.updateTag);
router.delete("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, handleApiValidationErrors, AdminTaxonomyController.deleteTag);

// ---- Resources ---- (rooms/equipment/tables used for appointments - booking-only)
router.get("/resources", requireModule("booking"), requirePermission("manage_resources"), AdminTaxonomyController.listResources);
router.get("/resources/:resourceId", requireModule("booking"), requirePermission("manage_resources"), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.getResource);
router.post("/resources", requireModule("booking"), requirePermission("manage_resources"), validateResourceCreate, handleApiValidationErrors, AdminTaxonomyController.createResource);
router.put("/resources/:resourceId", requireModule("booking"), requirePermission("manage_resources"), validateResourceId, validateResourceUpdate, handleApiValidationErrors, AdminTaxonomyController.updateResource);
router.delete("/resources/:resourceId", requireModule("booking"), requirePermission("manage_resources"), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.deleteResource);

export default router;
