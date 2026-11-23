import { Router } from "express";
import { employeeMiddleware } from "../../middlewares/employee.middleware.js";
import * as EmployeeController from "../../controllers/web/employee/employee.controller.js";
import { validateAppointmentId, validateAppointmentReject, validateAppointmentNoShow, validateAppointmentReschedule } from "../../middlewares/validators/appointment.validator.js";
import { validateWorkingHoursUpdate } from "../../middlewares/validators/employee.validator.js";
import { validatePayoutRequest } from "../../middlewares/validators/payout-request.validator.js";
import * as EmployeeCardController from "../../controllers/web/employee/employee-card.controller.js";
import { validateEmployeeCard } from "../../middlewares/validators/employee-card.validator.js";
import { processUpload } from "../../config/multer.config.js";
import { csrfAfterMulter } from "../../config/csrf.config.js";
import { parseJsonFields } from "../../middlewares/parse-json-fields.middleware.js";

const router = Router();

// mounted at /moj-nalog in web.routes.js - symmetric with the customer's /nalog.
// employeeMiddleware lives here (not in web.routes.js) so this router is self-contained:
// anyone mounting it elsewhere gets the same guard for free.
router.use(employeeMiddleware);

router.get("/", EmployeeController.dashboard);

router.get("/termini", EmployeeController.appointments);
router.get("/termini/detalji/:appointmentId", validateAppointmentId, EmployeeController.appointmentDetails);
router.put("/termini/:appointmentId/potvrdi", validateAppointmentId, EmployeeController.confirmAppointment);
router.put("/termini/:appointmentId/odbij", validateAppointmentId, validateAppointmentReject, EmployeeController.rejectAppointment);
router.put("/termini/:appointmentId/zavrsi", validateAppointmentId, EmployeeController.completeAppointment);
router.put("/termini/:appointmentId/nije-se-pojavio", validateAppointmentId, validateAppointmentNoShow, EmployeeController.noShowAppointment);
router.put("/termini/:appointmentId/pomeri", validateAppointmentId, validateAppointmentReschedule, EmployeeController.rescheduleAppointment);

router.get("/provizije", EmployeeController.commissions);
router.get("/isplate", EmployeeController.payoutHistory);
router.post("/isplata", validatePayoutRequest, EmployeeController.requestPayout);

router.get("/profil", EmployeeController.profile);
router.put("/profil/radno-vreme", parseJsonFields("workingHours"), validateWorkingHoursUpdate, EmployeeController.updateWorkingHours);

// virtuelna vizitka (javna strana /vizitka/:slug + QR). Multipart (slika) -> CSRF token ide u telu
// (CSRFToken) i proverava se posle multera, isto kao u admin upload rutama.
router.get("/vizitka", EmployeeCardController.cardPage);
router.post("/vizitka", ...processUpload("photo", "vizitke"), csrfAfterMulter, validateEmployeeCard, EmployeeCardController.saveCard);
router.post("/vizitka/novi-link", EmployeeCardController.regenerateLink);
router.get("/vizitka/qr/:format", EmployeeCardController.qrDownload);

export default router;