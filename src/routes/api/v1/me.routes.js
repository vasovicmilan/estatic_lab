import { Router } from "express";
import * as MeController from "../../../controllers/api/v1/me.controller.js";
import { validateProfileUpdate, validateAddressCreate, validateAddressId } from "../../../middlewares/validators/user.validator.js";
import { validateChangePassword, validateDeactivateAccount } from "../../../middlewares/validators/auth.validator.js";
import { validateAppointmentCancel, validateAppointmentReschedule, validateAppointmentId } from "../../../middlewares/validators/appointment.validator.js";
import { validateOrderCancel, validateOrderId } from "../../../middlewares/validators/order.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";

const router = Router();

// Every /me route is the authenticated caller's own account - apiAuthMiddleware for
// the whole router, once, rather than per-route.
router.use(apiAuthMiddleware);

router.get("/", MeController.getProfile);
router.put("/", validateProfileUpdate, handleApiValidationErrors, MeController.updateProfile);
router.put("/password", validateChangePassword, handleApiValidationErrors, MeController.changePassword);
router.delete("/", validateDeactivateAccount, handleApiValidationErrors, MeController.deactivateAccount);

router.get("/appointments", MeController.listAppointments);
router.get("/appointments/:appointmentId", validateAppointmentId, handleApiValidationErrors, MeController.getAppointment);
router.post("/appointments/:appointmentId/cancel", validateAppointmentId, validateAppointmentCancel, handleApiValidationErrors, MeController.cancelAppointment);
router.post("/appointments/:appointmentId/reschedule", validateAppointmentId, validateAppointmentReschedule, handleApiValidationErrors, MeController.rescheduleAppointment);

router.get("/orders", MeController.listOrders);
router.get("/orders/:orderId", validateOrderId, handleApiValidationErrors, MeController.getOrder);
router.post("/orders/:orderId/cancel", validateOrderId, validateOrderCancel, handleApiValidationErrors, MeController.cancelOrder);

router.get("/addresses", MeController.listAddresses);
router.post("/addresses", validateAddressCreate, handleApiValidationErrors, MeController.addAddress);
router.delete("/addresses/:addressId", validateAddressId, handleApiValidationErrors, MeController.removeAddress);
router.put("/addresses/:addressId/default", validateAddressId, handleApiValidationErrors, MeController.setDefaultAddress);

export default router;
