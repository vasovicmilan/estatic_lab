import { Router } from "express";
import { employeeMiddleware } from "../../middlewares/employee.middleware.js";
import * as EmployeeController from "../../controllers/web/employee/employee.controller.js";
import { validateAppointmentId, validateAppointmentReject } from "../../middlewares/validators/appointment.validator.js";
import { validateWorkingHoursUpdate } from "../../middlewares/validators/employee.validator.js";

const router = Router();

router.use(employeeMiddleware);

router.get("/moj-kalendar", EmployeeController.dashboard);

router.get("/moji-termini", EmployeeController.appointments);
router.get("/moji-termini/detalji/:appointmentId", validateAppointmentId, EmployeeController.appointmentDetails);
router.post("/moji-termini/:appointmentId/potvrdi", validateAppointmentId, EmployeeController.confirmAppointment);
router.post("/moji-termini/:appointmentId/odbij", validateAppointmentId, validateAppointmentReject, EmployeeController.rejectAppointment);
router.post("/moji-termini/:appointmentId/zavrsi", validateAppointmentId, EmployeeController.completeAppointment);

router.get("/moj-profil", EmployeeController.profile);
router.post("/moj-profil/radno-vreme", validateWorkingHoursUpdate, EmployeeController.updateWorkingHours);

export default router;