import { Router } from "express";
import * as AdminPeopleController from "../../../controllers/api/v1/admin-people.controller.js";
import { validateUserId, validateUserStatus, validateUserRole, validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";
import { validateEmployeeCreate, validateEmployeeUpdate, validateEmployeeId, validateWorkingHoursUpdate } from "../../../middlewares/validators/employee.validator.js";
import { validateExpertCreate, validateExpertUpdate, validateExpertId } from "../../../middlewares/validators/expert.validator.js";
import { validatePartnerCreate, validatePartnerUpdate, validatePartnerId } from "../../../middlewares/validators/partner.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Users ---- (not module-specific - accounts exist regardless of which modules are enabled)
router.get("/users", requirePermission(PERMISSION.MANAGE_USERS), AdminPeopleController.listUsers);
router.get("/users/:userId", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, handleApiValidationErrors, AdminPeopleController.getUser);
router.put("/users/:userId", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, validateProfileUpdate, handleApiValidationErrors, AdminPeopleController.updateUser);
router.put("/users/:userId/status", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, validateUserStatus, handleApiValidationErrors, AdminPeopleController.updateUserStatus);
router.put("/users/:userId/role", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, validateUserRole, handleApiValidationErrors, AdminPeopleController.updateUserRole);
router.put("/users/:userId/verify", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, handleApiValidationErrors, AdminPeopleController.verifyUser);
router.put("/users/:userId/anonymize", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, handleApiValidationErrors, AdminPeopleController.anonymizeUser);
router.delete("/users/:userId", requirePermission(PERMISSION.MANAGE_USERS), validateUserId, handleApiValidationErrors, AdminPeopleController.deleteUser);

// ---- Employees ---- (a real login+schedule staff account that fulfils appointments - booking-only)
router.get("/employees", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), AdminPeopleController.listEmployees);
router.get("/employees/:employeeId", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeId, handleApiValidationErrors, AdminPeopleController.getEmployee);
router.get("/employees/:employeeId/edit", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeId, handleApiValidationErrors, AdminPeopleController.getEmployeeForEdit);
router.post("/employees", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeCreate, handleApiValidationErrors, AdminPeopleController.createEmployee);
router.put("/employees/:employeeId", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeId, validateEmployeeUpdate, handleApiValidationErrors, AdminPeopleController.updateEmployee);
router.put("/employees/:employeeId/working-hours", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeId, validateWorkingHoursUpdate, handleApiValidationErrors, AdminPeopleController.updateEmployeeWorkingHours);
router.delete("/employees/:employeeId", requireModule("employees"), requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateEmployeeId, handleApiValidationErrors, AdminPeopleController.deleteEmployee);

// ---- Experts ---- (NOT module-gated - a public "our team" showcase profile,
// deliberately independent of Employee/booking, see expert.model.js's own
// comment: works with zero login accounts behind it)
router.get("/experts", requirePermission(PERMISSION.MANAGE_EMPLOYEES), AdminPeopleController.listExperts);
router.get("/experts/:expertId", requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateExpertId, handleApiValidationErrors, AdminPeopleController.getExpert);
// Raw/edit shape - see admin-people.controller.js's getExpertForEdit header
// comment for why this is a second endpoint rather than changing getExpert's
// response (same reasoning as admin-catalog.routes.js's :id/edit routes).
router.get("/experts/:expertId/edit", requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateExpertId, handleApiValidationErrors, AdminPeopleController.getExpertForEdit);
router.post("/experts", requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateExpertCreate, handleApiValidationErrors, AdminPeopleController.createExpert);
router.put("/experts/:expertId", requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateExpertId, validateExpertUpdate, handleApiValidationErrors, AdminPeopleController.updateExpert);
router.delete("/experts/:expertId", requirePermission(PERMISSION.MANAGE_EMPLOYEES), validateExpertId, handleApiValidationErrors, AdminPeopleController.deleteExpert);

// ---- Partners ----
router.get("/partners", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), AdminPeopleController.listPartners);
router.get("/partners/:partnerId", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), validatePartnerId, handleApiValidationErrors, AdminPeopleController.getPartner);
// Raw/edit shape - see admin-people.controller.js's getPartnerForEdit header
// comment for why this is a second endpoint rather than changing getPartner's
// response (same reasoning as the Employee/Expert :id/edit routes above).
router.get("/partners/:partnerId/edit", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), validatePartnerId, handleApiValidationErrors, AdminPeopleController.getPartnerForEdit);
router.post("/partners", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), validatePartnerCreate, handleApiValidationErrors, AdminPeopleController.createPartner);
router.put("/partners/:partnerId", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), validatePartnerId, validatePartnerUpdate, handleApiValidationErrors, AdminPeopleController.updatePartner);
router.delete("/partners/:partnerId", requireModule("partners"), requirePermission(PERMISSION.MANAGE_PARTNERS), validatePartnerId, handleApiValidationErrors, AdminPeopleController.deletePartner);

export default router;
