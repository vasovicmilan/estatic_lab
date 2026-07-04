import { Router } from "express";
import * as ExpertController from "../../../controllers/web/admin/auth/expert.controller.js";
import { validateExpertCreate, validateExpertUpdate, validateExpertId } from "../../../middlewares/validators/expert.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processUpload } from "../../../config/multer.config.js";

const router = Router();

router.get("/", validateSearch, ExpertController.listExperts);
router.get("/dodavanje", ExpertController.newExpertForm);
router.get("/detalji/:expertId", validateExpertId, ExpertController.expertDetails);
router.get("/izmena/:expertId", validateExpertId, ExpertController.editExpertForm);

router.post(
  "/",
  ...processUpload("expertImage", "experts"),
  csrfAfterMulter,
  validateExpertCreate,
  ExpertController.createExpert
);

router.put(
  "/:expertId",
  validateExpertId,
  ...processUpload("expertImage", "experts"),
  csrfAfterMulter,
  validateExpertUpdate,
  ExpertController.updateExpert
);

router.delete("/:expertId", validateExpertId, ExpertController.deleteExpert);

export default router;
