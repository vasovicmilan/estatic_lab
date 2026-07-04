import { Router } from "express";
import * as BookingController from "../../controllers/web/public/booking.controller.js";
import { validateBookingConfirm } from "../../middlewares/validators/booking.validator.js";
import { validateHoneypot } from "../../middlewares/validators/spam.validator.js";
import { bookingLimiter, availabilityLimiter } from "../../middlewares/rate-limiter.middleware.js";

const router = Router();

router.get("/potvrda/:appointmentId", BookingController.confirmation);

router.get("/:serviceSlug", BookingController.serviceStep);
router.get("/:serviceSlug/termin", availabilityLimiter, BookingController.slotsStep);
router.get("/:serviceSlug/podaci", BookingController.contactStep);

router.post(
  "/potvrda",
  bookingLimiter,
  validateHoneypot,
  validateBookingConfirm,
  BookingController.confirmBooking
);

export default router;
