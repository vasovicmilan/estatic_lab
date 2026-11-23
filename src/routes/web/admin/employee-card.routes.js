import { Router } from "express";
import * as EmployeeCardController from "../../../controllers/web/admin/auth/employee-card.controller.js";
import { validateEmployeeCardId } from "../../../middlewares/validators/employee-card.validator.js";

const router = Router();

router.get("/", EmployeeCardController.listCards);
router.post("/:cardId/status", validateEmployeeCardId, EmployeeCardController.setStatus);

export default router;
