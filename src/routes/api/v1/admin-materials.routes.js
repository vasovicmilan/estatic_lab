import { Router } from "express";
import * as AdminMaterialsController from "../../../controllers/api/v1/admin-materials.controller.js";
import { validateMaterialCreate, validateMaterialUpdate, validateMaterialId } from "../../../middlewares/validators/material.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";
import { processMaterialUpload } from "../../../config/material-upload.config.js";

const router = Router();
router.use(apiAuthMiddleware);

const materialUpload = processMaterialUpload("file");
const perm = requirePermission(PERMISSION.MANAGE_MARKETING);

// Materijali (PDF, katalozi, brošure). Brisanje se namerno ne izlaže preko API-ja.
// POST/PUT su multipart: polje "file" + title/description/isActive. Ovde nema CSRF-a jer je
// autentikacija Bearer token (ne kolačić), isto kao ostale /api/v1 rute.
router.get("/materials", perm, validateSearch, AdminMaterialsController.listMaterials);
router.get("/materials/:materialId", perm, validateMaterialId, handleApiValidationErrors, AdminMaterialsController.getMaterial);
router.get("/materials/:materialId/edit", perm, validateMaterialId, handleApiValidationErrors, AdminMaterialsController.getMaterialForEdit);
router.post("/materials", perm, ...materialUpload, validateMaterialCreate, AdminMaterialsController.createMaterial);
router.put("/materials/:materialId", perm, validateMaterialId, ...materialUpload, validateMaterialUpdate, AdminMaterialsController.updateMaterial);

export default router;
