import { Router } from "express";
import { webAuthMiddleware, optionalWebAuth } from "../../middlewares/auth.middleware.js";
import { requireModule } from "../../middlewares/feature.middleware.js";
import * as IndexController from "../../controllers/web/index.controller.js";
import * as SeoController from "../../controllers/web/seo.controller.js";
import { contactLimiter, newsletterLimiter, testimonialLimiter, couponLimiter } from "../../middlewares/rate-limiter.middleware.js";
import * as CouponController from "../../controllers/web/public/coupon.controller.js";
import * as BusinessPartnerController from "../../controllers/web/public/business-partner.controller.js";
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
import partnerRoutes from "./partner.routes.js";
import productRoutes from "./product.routes.js";
import shopRoutes from "./shop.routes.js";

const router = Router();

router.use(optionalWebAuth);

router.get("/robots.txt", SeoController.robotsTxt);
router.get("/sitemap.xml", SeoController.sitemapXml);
router.get("/llms.txt", SeoController.llmsTxt);

router.get("/", IndexController.homePage);

// static pages
router.get("/o-nama", IndexController.aboutPage);
router.get("/partnerski-program", requireModule("partners"), IndexController.partnershipPage);
router.get("/politika-privatnosti", IndexController.privacyPage);
router.get("/uslovi-koriscenja", IndexController.termsPage);
router.get("/faq", IndexController.faqPage);
router.get("/kontakt", IndexController.contactPage);

router.get("/saradnici", BusinessPartnerController.businessPartnerList);
router.get("/saradnici/:slug", BusinessPartnerController.businessPartnerDetails);

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

// /nas-tim (Expert - the public "our team" showcase) is deliberately NOT
// module-gated, same reasoning as catalog.routes.js's /team on the API side -
// see expert.model.js's own comment: works with zero login/booking behind it.
router.use("/nas-tim", teamRoutes);
router.use("/usluge", requireModule("booking"), serviceRoutes);
router.use("/paketi", requireModule("booking"), packageRoutes);
router.use("/blog", requireModule("blog"), blogRoutes);
router.use("/zakazivanje", requireModule("booking"), bookingRoutes);
router.use("/prodavnica", requireModule("shop"), productRoutes);

router.post("/kupon/primeni", requireModule("coupons"), couponLimiter, CouponController.applyCoupon);
router.post("/kupon/ukloni", requireModule("coupons"), CouponController.removeCoupon);
router.use("/korpa", requireModule("shop"), shopRoutes);

router.use("/", authRoutes);

router.use("/admin", webAuthMiddleware, adminRoutes);
router.use("/nalog", webAuthMiddleware, userRoutes);
router.use("/moj-nalog", requireModule("employees"), webAuthMiddleware, employeeRoutes);
router.use("/moj-partner-nalog", requireModule("partners"), webAuthMiddleware, partnerRoutes);

export default router;