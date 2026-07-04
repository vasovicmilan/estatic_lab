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

// static pages
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

// auth.routes.js defines its own full paths ("/prijava", "/registracija", "/odjava"...)
router.use("/", authRoutes);

router.use("/admin", webAuthMiddleware, adminRoutes);
router.use("/nalog", webAuthMiddleware, userRoutes);
router.use("/moj-nalog", webAuthMiddleware, employeeRoutes);

// ============================================================================
// TEMPORARY — REMOVE BEFORE PRODUCTION
// One-time bootstrap route: roles must exist before anyone can register (the
// first registration becomes admin, but only if the "admin" role document
// already exists — see user.service.js resolveRegistrationRole()). Gated by
// SEED_SECRET so it's not wide open even while it's still in the codebase;
// still, delete this whole block once you've seeded your database once.
// ============================================================================
// router.get("/seed/role", async (req, res, next) => {
//   try {

//     const { seedRoles } = await import("../../database/seeds/roles.seed.js");
//     const roles = await seedRoles();

//     return res.json({
//       success: true,
//       message: "Role su uspešno kreirane. Sada se možete registrovati — prvi registrovani korisnik postaje admin.",
//       roles: roles.map((r) => ({ id: r._id, name: r.name, isDefault: r.isDefault })),
//     });
//   } catch (error) {
//     next(error);
//   }
// });

export default router;