import { Router } from "express";
import * as EmployeeController from "../../../controllers/web/admin/auth/employee.controller.js";
import {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateWorkingHoursUpdate,
  validateEmployeeId,
} from "../../../middlewares/validators/employee.validator.js";
import { parseJsonFields } from "../../../middlewares/parse-json-fields.middleware.js";
import { sanitizeArrayFields } from "../../../middlewares/sanitize-array-fields.middleware.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, EmployeeController.listEmployees);
router.get("/dodavanje", EmployeeController.newEmployeeForm);
router.get("/detalji/:employeeId", validateEmployeeId, EmployeeController.employeeDetails);
router.get("/izmena/:employeeId", validateEmployeeId, EmployeeController.editEmployeeForm);

router.post("/", sanitizeArrayFields("services"), parseJsonFields("workingHours"), validateEmployeeCreate, EmployeeController.createEmployee);

router.put("/:employeeId", validateEmployeeId, sanitizeArrayFields("services"), parseJsonFields("workingHours"), validateEmployeeUpdate, EmployeeController.updateEmployee);
router.put("/:employeeId/radno-vreme", validateEmployeeId, parseJsonFields("workingHours"), validateWorkingHoursUpdate, EmployeeController.updateWorkingHours);

router.delete("/:employeeId", validateEmployeeId, EmployeeController.deleteEmployee);

export default router;