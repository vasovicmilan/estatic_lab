import { Router } from "express";
import { webAuthMiddleware, optionalWebAuth } from "../../middlewares/auth.middleware.js";
import * as IndexController from "../../controllers/web/index.controller.js";
import { contactLimiter, newsletterLimiter, testimonialLimiter } from "../../middlewares/rate-limiter.middleware.js";
import { validateContactCreate } from "../../middlewares/validators/contact.validator.js";
import { validateNewsletterSubscribe } from "../../middlewares/validators/newsletter.validator.js";
import { validateTestimonialSubmit } from "../../middlewares/validators/testimonial.validator.js";
import { validateHoneypot } from "../../middlewares/validators/spam.validator.js";

import adminRoutes from "./admin.routes.js";
import authRoutes from "./auth.routes.js";
import blogRoutes from "./blog.routes.js";
import serviceRoutes from "./service.routes.js";
import packageRoutes from "./package.routes.js";
import bookingRoutes from "./booking.routes.js";
import teamRoutes from "./team.routes.js";
import userRoutes from "./user.routes.js";
import employeeRoutes from "./employee.routes.js";

const router = Router();

router.use(optionalWebAuth);

router.get("/", IndexController.homePage);

router.get("/o-nama", IndexController.aboutPage);
router.get("/politika-privatnosti", IndexController.privacyPage);
router.get("/uslovi-koriscenja", IndexController.termsPage);
router.get("/faq", IndexController.faqPage);
router.get("/kontakt", IndexController.contactPage);

router.post(
  "/kontakt",
  contactLimiter,
  validateHoneypot,
  validateContactCreate,
  IndexController.submitContact
);

router.post(
  "/newsletter/prijava",
  newsletterLimiter,
  validateHoneypot,
  validateNewsletterSubscribe,
  IndexController.submitNewsletter
);

router.get("/newsletter/odjava/:token", IndexController.unsubscribeNewsletter);

router.post(
  "/testimonials/posalji",
  testimonialLimiter,
  validateHoneypot,
  validateTestimonialSubmit,
  IndexController.submitTestimonial
);

router.use("/nas-tim", teamRoutes);
router.use("/usluge", serviceRoutes);
router.use("/paketi", packageRoutes);
router.use("/blog", blogRoutes);
router.use("/zakazivanje", bookingRoutes);


router.use("/", authRoutes);

router.use("/admin", webAuthMiddleware, adminRoutes);
router.use("/nalog", webAuthMiddleware, userRoutes);
router.use("/", employeeRoutes);

export default router;