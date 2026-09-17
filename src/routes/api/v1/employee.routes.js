import { Router } from "express";
import * as EmployeeController from "../../../controllers/api/v1/employee.controller.js";
import { validateAppointmentId, validateAppointmentReject, validateAppointmentNoShow, validateAppointmentReschedule } from "../../../middlewares/validators/appointment.validator.js";
import { validateWorkingHoursUpdate } from "../../../middlewares/validators/employee.validator.js";
import { validatePayoutRequest } from "../../../middlewares/validators/payout-request.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { employeeMiddleware } from "../../../middlewares/employee.middleware.js";

const router = Router();

// employeeMiddleware already reads req.user (not req.session.user) - see the
// earlier auth-middleware fix - so it gates a Bearer-token request exactly the
// same way it gates a session one, on req.user.isEmployee.
router.use(apiAuthMiddleware, employeeMiddleware);

router.get("/dashboard", EmployeeController.dashboard);

router.get("/appointments", EmployeeController.listAppointments);
router.get("/appointments/:appointmentId", validateAppointmentId, handleApiValidationErrors, EmployeeController.getAppointment);
router.post("/appointments/:appointmentId/confirm", validateAppointmentId, handleApiValidationErrors, EmployeeController.confirmAppointment);
router.post("/appointments/:appointmentId/reject", validateAppointmentId, validateAppointmentReject, handleApiValidationErrors, EmployeeController.rejectAppointment);
router.post("/appointments/:appointmentId/complete", validateAppointmentId, handleApiValidationErrors, EmployeeController.completeAppointment);
router.post("/appointments/:appointmentId/no-show", validateAppointmentId, validateAppointmentNoShow, handleApiValidationErrors, EmployeeController.noShowAppointment);
router.post("/appointments/:appointmentId/reschedule", validateAppointmentId, validateAppointmentReschedule, handleApiValidationErrors, EmployeeController.rescheduleAppointment);

router.get("/profile", EmployeeController.getProfile);
router.put("/profile/working-hours", validateWorkingHoursUpdate, handleApiValidationErrors, EmployeeController.updateWorkingHours);

router.get("/commissions", EmployeeController.listCommissions);
router.get("/payouts", EmployeeController.listPayouts);
router.post("/payouts", validatePayoutRequest, handleApiValidationErrors, EmployeeController.requestPayout);

export default router;
