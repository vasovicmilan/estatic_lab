import { Router } from "express";
import * as PublicFormsController from "../../../controllers/api/v1/public-forms.controller.js";
import { validateContactCreate } from "../../../middlewares/validators/contact.validator.js";
import { validateNewsletterSubscribe } from "../../../middlewares/validators/newsletter.validator.js";
import { validateTestimonialSubmit } from "../../../middlewares/validators/testimonial.validator.js";
import { validateHoneypot } from "../../../middlewares/validators/spam.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { contactLimiter, newsletterLimiter, testimonialLimiter } from "../../../middlewares/rate-limiter.middleware.js";

// Gap fix (see public-forms.controller.js's header comment) - three public
// submission endpoints that only ever existed as HTML-form POSTs on the web
// side. Same rate limiters + honeypot + validators as their web equivalents
// (web.routes.js) - no auth required on any of these, exactly like the web
// forms, which are all reachable by a logged-out visitor.

const router = Router();

router.post("/contact", contactLimiter, validateHoneypot, validateContactCreate, handleApiValidationErrors, PublicFormsController.submitContact);
router.post("/newsletter-subscribe", newsletterLimiter, validateHoneypot, validateNewsletterSubscribe, handleApiValidationErrors, PublicFormsController.subscribeNewsletter);
router.post("/testimonials", testimonialLimiter, validateHoneypot, validateTestimonialSubmit, handleApiValidationErrors, PublicFormsController.submitTestimonial);

export default router;
