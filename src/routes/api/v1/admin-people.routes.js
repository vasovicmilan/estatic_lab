import { Router } from "express";
import * as AdminPeopleController from "../../../controllers/api/v1/admin-people.controller.js";
import { validateUserId, validateUserStatus, validateUserRole, validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";
import { validateEmployeeCreate, validateEmployeeUpdate, validateEmployeeId, validateWorkingHoursUpdate } from "../../../middlewares/validators/employee.validator.js";
import { validateExpertCreate, validateExpertUpdate, validateExpertId } from "../../../middlewares/validators/expert.validator.js";
import { validatePartnerCreate, validatePartnerUpdate, validatePartnerId } from "../../../middlewares/validators/partner.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Users ---- (not module-specific - accounts exist regardless of which modules are enabled)
router.get("/users", requirePermission("manage_users"), AdminPeopleController.listUsers);
router.get("/users/:userId", requirePermission("manage_users"), validateUserId, handleApiValidationErrors, AdminPeopleController.getUser);
router.put("/users/:userId", requirePermission("manage_users"), validateUserId, validateProfileUpdate, handleApiValidationErrors, AdminPeopleController.updateUser);
router.put("/users/:userId/status", requirePermission("manage_users"), validateUserId, validateUserStatus, handleApiValidationErrors, AdminPeopleController.updateUserStatus);
router.put("/users/:userId/role", requirePermission("manage_users"), validateUserId, validateUserRole, handleApiValidationErrors, AdminPeopleController.updateUserRole);
router.put("/users/:userId/verify", requirePermission("manage_users"), validateUserId, handleApiValidationErrors, AdminPeopleController.verifyUser);
router.put("/users/:userId/anonymize", requirePermission("manage_users"), validateUserId, handleApiValidationErrors, AdminPeopleController.anonymizeUser);
router.delete("/users/:userId", requirePermission("manage_users"), validateUserId, handleApiValidationErrors, AdminPeopleController.deleteUser);

// ---- Employees ---- (a real login+schedule staff account that fulfils appointments - booking-only)
router.get("/employees", requireModule("employees"), requirePermission("manage_employees"), AdminPeopleController.listEmployees);
router.get("/employees/:employeeId", requireModule("employees"), requirePermission("manage_employees"), validateEmployeeId, handleApiValidationErrors, AdminPeopleController.getEmployee);
router.post("/employees", requireModule("employees"), requirePermission("manage_employees"), validateEmployeeCreate, handleApiValidationErrors, AdminPeopleController.createEmployee);
router.put("/employees/:employeeId", requireModule("employees"), requirePermission("manage_employees"), validateEmployeeId, validateEmployeeUpdate, handleApiValidationErrors, AdminPeopleController.updateEmployee);
router.put("/employees/:employeeId/working-hours", requireModule("employees"), requirePermission("manage_employees"), validateEmployeeId, validateWorkingHoursUpdate, handleApiValidationErrors, AdminPeopleController.updateEmployeeWorkingHours);
router.delete("/employees/:employeeId", requireModule("employees"), requirePermission("manage_employees"), validateEmployeeId, handleApiValidationErrors, AdminPeopleController.deleteEmployee);

// ---- Experts ---- (NOT module-gated - a public "our team" showcase profile,
// deliberately independent of Employee/booking, see expert.model.js's own
// comment: works with zero login accounts behind it)
router.get("/experts", requirePermission("manage_employees"), AdminPeopleController.listExperts);
router.get("/experts/:expertId", requirePermission("manage_employees"), validateExpertId, handleApiValidationErrors, AdminPeopleController.getExpert);
router.post("/experts", requirePermission("manage_employees"), validateExpertCreate, handleApiValidationErrors, AdminPeopleController.createExpert);
router.put("/experts/:expertId", requirePermission("manage_employees"), validateExpertId, validateExpertUpdate, handleApiValidationErrors, AdminPeopleController.updateExpert);
router.delete("/experts/:expertId", requirePermission("manage_employees"), validateExpertId, handleApiValidationErrors, AdminPeopleController.deleteExpert);

// ---- Partners ----
router.get("/partners", requireModule("partners"), requirePermission("manage_partners"), AdminPeopleController.listPartners);
router.get("/partners/:partnerId", requireModule("partners"), requirePermission("manage_partners"), validatePartnerId, handleApiValidationErrors, AdminPeopleController.getPartner);
router.post("/partners", requireModule("partners"), requirePermission("manage_partners"), validatePartnerCreate, handleApiValidationErrors, AdminPeopleController.createPartner);
router.put("/partners/:partnerId", requireModule("partners"), requirePermission("manage_partners"), validatePartnerId, validatePartnerUpdate, handleApiValidationErrors, AdminPeopleController.updatePartner);
router.delete("/partners/:partnerId", requireModule("partners"), requirePermission("manage_partners"), validatePartnerId, handleApiValidationErrors, AdminPeopleController.deletePartner);

export default router;
