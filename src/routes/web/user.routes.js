import { Router } from "express";
import * as UserController from "../../controllers/web/user/user.controller.js";
import { validateProfileUpdate, validateAddressCreate, validateAddressId } from "../../middlewares/validators/user.validator.js";
import { validateChangePassword, validateDeactivateAccount } from "../../middlewares/validators/auth.validator.js";
import { validateAppointmentId, validateAppointmentCancel } from "../../middlewares/validators/appointment.validator.js";
import { validateOrderId, validateOrderCancel } from "../../middlewares/validators/order.validator.js";
import * as AuthController from "../../controllers/web/auth/auth.controller.js";

const router = Router();

router.get("/", UserController.profile);
router.get("/termini", UserController.appointments);
router.get("/termini/detalji/:appointmentId", validateAppointmentId, UserController.appointmentDetails);
router.post("/termini/:appointmentId/otkazi", validateAppointmentId, validateAppointmentCancel, UserController.cancelAppointment);

router.get("/porudzbine", UserController.orders);
router.get("/porudzbine/detalji/:orderId", validateOrderId, UserController.orderDetails);
router.post("/porudzbine/:orderId/otkazi", validateOrderId, validateOrderCancel, UserController.cancelOrder);

router.get("/adrese", UserController.addresses);
router.post("/adrese", validateAddressCreate, UserController.addAddress);
router.post("/adrese/:addressId/ukloni", validateAddressId, UserController.removeAddress);
router.post("/adrese/:addressId/podrazumevana", validateAddressId, UserController.setDefaultAddress);

router.get("/podesavanja", UserController.settingsForm);
router.post("/podesavanja", validateProfileUpdate, UserController.updateSettings);
router.post("/podesavanja/lozinka", validateChangePassword, AuthController.changePassword);
router.post("/podesavanja/deaktiviraj", validateDeactivateAccount, AuthController.deactivateAccount);

export default router;