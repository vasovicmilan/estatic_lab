import { Router } from "express";
import * as MaterialController from "../../../controllers/web/admin/marketing/material.controller.js";
import { validateMaterialCreate, validateMaterialUpdate, validateMaterialId } from "../../../middlewares/validators/material.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMaterialUpload } from "../../../config/material-upload.config.js";

const router = Router();

const materialUpload = processMaterialUpload("file");

router.get("/", validateSearch, MaterialController.listMaterials);
router.get("/dodavanje", MaterialController.newMaterialForm);
router.get("/detalji/:materialId", validateMaterialId, MaterialController.materialDetails);
router.get("/izmena/:materialId", validateMaterialId, MaterialController.editMaterialForm);
router.get("/:materialId/qr.:format", validateMaterialId, (req, res, next) => {
  if (!["svg", "png"].includes(req.params.format)) return next("route");
  return MaterialController.qrDownload(req, res, next);
});

router.post("/", ...materialUpload, csrfAfterMulter, validateMaterialCreate, MaterialController.createMaterial);
router.put("/:materialId", validateMaterialId, ...materialUpload, csrfAfterMulter, validateMaterialUpdate, MaterialController.updateMaterial);
router.delete("/:materialId", validateMaterialId, MaterialController.deleteMaterial);

export default router;
