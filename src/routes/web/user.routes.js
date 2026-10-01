import { requireModule } from "../../middlewares/feature.middleware.js";
import { Router } from "express";
import * as UserController from "../../controllers/web/user/user.controller.js";
import { validateProfileUpdate, validateAddressCreate, validateAddressId } from "../../middlewares/validators/user.validator.js";
import { validateChangePassword, validateDeactivateAccount } from "../../middlewares/validators/auth.validator.js";
import { validateAppointmentId, validateAppointmentCancel, validateAppointmentReschedule } from "../../middlewares/validators/appointment.validator.js";
import { validateOrderId, validateOrderCancel } from "../../middlewares/validators/order.validator.js";
import * as AuthController from "../../controllers/web/auth/auth.controller.js";

const router = Router();

router.get("/", UserController.profile);
router.get("/termini", requireModule("booking"), UserController.appointments);
router.get("/termini/detalji/:appointmentId", requireModule("booking"), validateAppointmentId, UserController.appointmentDetails);
router.put("/termini/:appointmentId/otkazi", requireModule("booking"), validateAppointmentId, validateAppointmentCancel, UserController.cancelAppointment);
router.put("/termini/:appointmentId/pomeri", requireModule("booking"), validateAppointmentId, validateAppointmentReschedule, UserController.rescheduleAppointment);

router.get("/porudzbine", requireModule("shop"), UserController.orders);
router.get("/porudzbine/detalji/:orderId", requireModule("shop"), validateOrderId, UserController.orderDetails);
router.put("/porudzbine/:orderId/otkazi", requireModule("shop"), validateOrderId, validateOrderCancel, UserController.cancelOrder);

router.get("/adrese", requireModule("shop"), UserController.addresses);
router.post("/adrese", requireModule("shop"), validateAddressCreate, UserController.addAddress);
router.delete("/adrese/:addressId/ukloni", requireModule("shop"), validateAddressId, UserController.removeAddress);
router.put("/adrese/:addressId/podrazumevana", requireModule("shop"), validateAddressId, UserController.setDefaultAddress);

router.get("/podesavanja", UserController.settingsForm);
router.put("/podesavanja", validateProfileUpdate, UserController.updateSettings);
router.put("/podesavanja/lozinka", validateChangePassword, AuthController.changePassword);
router.put("/podesavanja/deaktiviraj", validateDeactivateAccount, AuthController.deactivateAccount);

export default router;