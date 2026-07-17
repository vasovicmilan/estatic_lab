import { Router } from "express";
import { employeeMiddleware } from "../../middlewares/employee.middleware.js";
import * as EmployeeController from "../../controllers/web/employee/employee.controller.js";
import { validateAppointmentId, validateAppointmentReject, validateAppointmentNoShow } from "../../middlewares/validators/appointment.validator.js";
import { validateWorkingHoursUpdate } from "../../middlewares/validators/employee.validator.js";
import { parseJsonFields } from "../../middlewares/parse-json-fields.middleware.js";

const router = Router();

// mounted at /moj-nalog in web.routes.js - symmetric with the customer's /nalog.
// employeeMiddleware lives here (not in web.routes.js) so this router is self-contained:
// anyone mounting it elsewhere gets the same guard for free.
router.use(employeeMiddleware);

router.get("/", EmployeeController.dashboard);

router.get("/termini", EmployeeController.appointments);
router.get("/termini/detalji/:appointmentId", validateAppointmentId, EmployeeController.appointmentDetails);
router.post("/termini/:appointmentId/potvrdi", validateAppointmentId, EmployeeController.confirmAppointment);
router.post("/termini/:appointmentId/odbij", validateAppointmentId, validateAppointmentReject, EmployeeController.rejectAppointment);
router.post("/termini/:appointmentId/zavrsi", validateAppointmentId, EmployeeController.completeAppointment);
router.post("/termini/:appointmentId/nije-se-pojavio", validateAppointmentId, validateAppointmentNoShow, EmployeeController.noShowAppointment);

router.get("/profil", EmployeeController.profile);
router.post("/profil/radno-vreme", parseJsonFields("workingHours"), validateWorkingHoursUpdate, EmployeeController.updateWorkingHours);

export default router;