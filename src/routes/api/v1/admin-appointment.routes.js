import { Router } from "express";
import * as AdminAppointmentController from "../../../controllers/api/v1/admin-appointment.controller.js";
import {
  validateAppointmentId,
  validateAppointmentReject,
  validateAppointmentNoShow,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentReschedule,
  validateManualAppointmentCreate,
} from "../../../middlewares/validators/appointment.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

const router = Router();
router.use(apiAuthMiddleware, requirePermission("manage_appointments_all"));

router.get("/", AdminAppointmentController.listAppointments);
router.get("/manual/check-package", AdminAppointmentController.checkManualAppointmentPackage);
router.post("/manual", validateManualAppointmentCreate, handleApiValidationErrors, AdminAppointmentController.createManualAppointment);
router.get("/:appointmentId", validateAppointmentId, handleApiValidationErrors, AdminAppointmentController.getAppointment);
router.put("/:appointmentId/confirm", validateAppointmentId, handleApiValidationErrors, AdminAppointmentController.confirmAppointment);
router.put("/:appointmentId/reject", validateAppointmentId, validateAppointmentReject, handleApiValidationErrors, AdminAppointmentController.rejectAppointment);
router.put("/:appointmentId/cancel", validateAppointmentId, validateAppointmentCancel, handleApiValidationErrors, AdminAppointmentController.cancelAppointment);
router.put("/:appointmentId/complete", validateAppointmentId, handleApiValidationErrors, AdminAppointmentController.completeAppointment);
router.put("/:appointmentId/no-show", validateAppointmentId, validateAppointmentNoShow, handleApiValidationErrors, AdminAppointmentController.noShowAppointment);
router.put("/:appointmentId/reopen", validateAppointmentId, handleApiValidationErrors, AdminAppointmentController.reopenAppointment);
router.put("/:appointmentId/reassign", validateAppointmentId, validateAppointmentReassign, handleApiValidationErrors, AdminAppointmentController.reassignAppointment);
router.put("/:appointmentId/reschedule", validateAppointmentId, validateAppointmentReschedule, handleApiValidationErrors, AdminAppointmentController.rescheduleAppointment);
router.delete("/:appointmentId", validateAppointmentId, handleApiValidationErrors, AdminAppointmentController.deleteAppointment);

export default router;
