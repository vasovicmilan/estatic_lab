import { Router } from "express";
import * as AdminTaxonomyController from "../../../controllers/api/v1/admin-taxonomy.controller.js";
import { validateRoleCreate, validateRoleUpdate, validateRoleId } from "../../../middlewares/validators/role.validator.js";
import { validateCategoryCreate, validateCategoryUpdate, validateCategoryId } from "../../../middlewares/validators/category.validator.js";
import { validateTagCreate, validateTagUpdate, validateTagId } from "../../../middlewares/validators/tag.validator.js";
import { validateResourceCreate, validateResourceUpdate, validateResourceId } from "../../../middlewares/validators/resource.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Roles ----
router.get("/roles", requirePermission("manage_roles"), AdminTaxonomyController.listRoles);
router.get("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.getRole);
router.post("/roles", requirePermission("manage_roles"), validateRoleCreate, handleApiValidationErrors, AdminTaxonomyController.createRole);
router.put("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, validateRoleUpdate, handleApiValidationErrors, AdminTaxonomyController.updateRole);
router.delete("/roles/:roleId", requirePermission("manage_roles"), validateRoleId, handleApiValidationErrors, AdminTaxonomyController.deleteRole);

// ---- Categories ----
router.get("/categories", requirePermission("manage_taxonomy"), AdminTaxonomyController.listCategories);
router.get("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.getCategory);
router.post("/categories", requirePermission("manage_taxonomy"), validateCategoryCreate, handleApiValidationErrors, AdminTaxonomyController.createCategory);
router.put("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, validateCategoryUpdate, handleApiValidationErrors, AdminTaxonomyController.updateCategory);
router.delete("/categories/:categoryId", requirePermission("manage_taxonomy"), validateCategoryId, handleApiValidationErrors, AdminTaxonomyController.deleteCategory);

// ---- Tags ----
router.get("/tags", requirePermission("manage_taxonomy"), AdminTaxonomyController.listTags);
router.get("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, handleApiValidationErrors, AdminTaxonomyController.getTag);
router.post("/tags", requirePermission("manage_taxonomy"), validateTagCreate, handleApiValidationErrors, AdminTaxonomyController.createTag);
router.put("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, validateTagUpdate, handleApiValidationErrors, AdminTaxonomyController.updateTag);
router.delete("/tags/:tagId", requirePermission("manage_taxonomy"), validateTagId, handleApiValidationErrors, AdminTaxonomyController.deleteTag);

// ---- Resources ----
router.get("/resources", requirePermission("manage_resources"), AdminTaxonomyController.listResources);
router.get("/resources/:resourceId", requirePermission("manage_resources"), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.getResource);
router.post("/resources", requirePermission("manage_resources"), validateResourceCreate, handleApiValidationErrors, AdminTaxonomyController.createResource);
router.put("/resources/:resourceId", requirePermission("manage_resources"), validateResourceId, validateResourceUpdate, handleApiValidationErrors, AdminTaxonomyController.updateResource);
router.delete("/resources/:resourceId", requirePermission("manage_resources"), validateResourceId, handleApiValidationErrors, AdminTaxonomyController.deleteResource);

export default router;
