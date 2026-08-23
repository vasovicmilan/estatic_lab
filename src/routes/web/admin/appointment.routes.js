import { Router } from "express";
import * as AppointmentController from "../../../controllers/web/admin/appointment/appointment.controller.js";
import * as ManualAppointmentController from "../../../controllers/web/admin/appointment/manual-appointment.controller.js";
import {
  validateAppointmentReject,
  validateAppointmentNoShow,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentReschedule,
  validateAppointmentId,
  validateManualAppointmentCreate,
} from "../../../middlewares/validators/appointment.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, AppointmentController.listAppointments);
router.get("/rucno-kreiranje", ManualAppointmentController.newManualAppointmentForm);
router.post("/rucno-kreiranje", validateManualAppointmentCreate, ManualAppointmentController.createManualAppointment);
router.get("/detalji/:appointmentId", validateAppointmentId, AppointmentController.appointmentDetails);

router.put("/:appointmentId/potvrdi", validateAppointmentId, AppointmentController.confirmAppointment);
router.put("/:appointmentId/odbij", validateAppointmentId, validateAppointmentReject, AppointmentController.rejectAppointment);
router.put("/:appointmentId/otkazi", validateAppointmentId, validateAppointmentCancel, AppointmentController.cancelAppointment);
router.put("/:appointmentId/zavrsi", validateAppointmentId, AppointmentController.completeAppointment);
router.put("/:appointmentId/nije-se-pojavio", validateAppointmentId, validateAppointmentNoShow, AppointmentController.noShowAppointment);
router.put("/:appointmentId/preraspodeli", validateAppointmentId, validateAppointmentReassign, AppointmentController.reassignAppointment);
router.put("/:appointmentId/pomeri", validateAppointmentId, validateAppointmentReschedule, AppointmentController.rescheduleAppointment);

router.delete("/:appointmentId", validateAppointmentId, AppointmentController.deleteAppointment);

export default router;