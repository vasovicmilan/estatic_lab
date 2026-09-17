import { Router } from "express";
import * as BookingController from "../../../controllers/api/v1/booking.controller.js";
import { validateBookingConfirm } from "../../../middlewares/validators/booking.validator.js";
import { validateHoneypot } from "../../../middlewares/validators/spam.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { optionalApiAuth } from "../../../middlewares/auth.middleware.js";
import { bookingLimiter, availabilityLimiter } from "../../../middlewares/rate-limiter.middleware.js";

const router = Router();

// optionalApiAuth on both - booking is open to guests (contact details collected
// directly, exactly like the web flow), but a logged-in caller gets extras a guest
// can't have: usablePackagePurchase in the slots response, and the appointment gets
// attached to their account instead of staying a guest booking.
router.get("/:serviceSlug/slots", availabilityLimiter, optionalApiAuth, BookingController.getSlots);
router.post("/confirm", bookingLimiter, optionalApiAuth, validateHoneypot, validateBookingConfirm, handleApiValidationErrors, BookingController.confirmBooking);

export default router;
