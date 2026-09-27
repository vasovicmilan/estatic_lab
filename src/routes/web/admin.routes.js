import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../models/role.model.js";
import { adminLimiter } from "../../middlewares/rate-limiter.middleware.js";

import * as DashboardController from "../../controllers/web/admin/dashboard.controller.js";
import roleRoutes from "./admin/role.routes.js";
import userRoutes from "./admin/user.routes.js";
import profileRoutes from "./admin/profile.routes.js";
import employeeRoutes from "./admin/employee.routes.js";
import partnerRoutes from "./admin/partner.routes.js";
import payoutRequestRoutes from "./admin/payout-request.routes.js";
import logSummaryRoutes from "./admin/log-summary.routes.js";
import businessReportRoutes from "./admin/business-report.routes.js";
import expertRoutes from "./admin/expert.routes.js";
import categoryRoutes from "./admin/category.routes.js";
import tagRoutes from "./admin/tag.routes.js";
import resourceRoutes from "./admin/resource.routes.js";
import serviceRoutes from "./admin/service.routes.js";
import packageRoutes from "./admin/package.routes.js";
import packagePurchaseRoutes from "./admin/package-purchase.routes.js";
import appointmentRoutes from "./admin/appointment.routes.js";
import postRoutes from "./admin/post.routes.js";
import contactRoutes from "./admin/contact.routes.js";
import couponRoutes from "./admin/coupon.routes.js";
import newsletterRoutes from "./admin/news-letter.routes.js";
import campaignRoutes from "./admin/campaign.routes.js";
import testimonialRoutes from "./admin/testimonial.routes.js";
import businessPartnerRoutes from "./admin/business-partner.routes.js";
import productRoutes from "./admin/product.routes.js";
import orderRoutes from "./admin/order.routes.js";
import temporaryOrderRoutes from "./admin/temporary-order.routes.js";
import siteSettingsRoutes from "./admin/site-settings.routes.js";

const router = Router();

router.use(adminMiddleware);
router.use(adminLimiter);

router.get("/", DashboardController.dashboard);

router.use("/role", requirePermission(PERMISSION.MANAGE_ROLES), roleRoutes);
router.use("/korisnici", requirePermission(PERMISSION.MANAGE_USERS), userRoutes);
router.use("/profil", profileRoutes);
router.use("/zaposleni", requirePermission(PERMISSION.MANAGE_EMPLOYEES), employeeRoutes);
router.use("/partneri", requirePermission(PERMISSION.MANAGE_PARTNERS), partnerRoutes);
router.use("/isplate", requirePermission(PERMISSION.MANAGE_PAYOUTS), payoutRequestRoutes);
router.use("/logovi", requirePermission(PERMISSION.VIEW_LOGS), logSummaryRoutes);
router.use("/poslovni-izvestaji", requirePermission(PERMISSION.VIEW_BUSINESS_REPORTS), businessReportRoutes);
router.use("/eksperti", requirePermission(PERMISSION.MANAGE_EMPLOYEES), expertRoutes);
router.use("/kategorije", requirePermission(PERMISSION.MANAGE_TAXONOMY), categoryRoutes);
router.use("/tagovi", requirePermission(PERMISSION.MANAGE_TAXONOMY), tagRoutes);
router.use("/resursi", requirePermission(PERMISSION.MANAGE_RESOURCES), resourceRoutes);
router.use("/usluge", requirePermission(PERMISSION.MANAGE_SERVICES), serviceRoutes);
router.use("/paketi", requirePermission(PERMISSION.MANAGE_PACKAGES), packageRoutes);
router.use("/kupljeni-paketi", requirePermission(PERMISSION.MANAGE_PACKAGES), packagePurchaseRoutes);
router.use("/termini", requirePermission(PERMISSION.MANAGE_APPOINTMENTS_ALL), appointmentRoutes);
router.use("/blog", requirePermission(PERMISSION.MANAGE_BLOG), postRoutes);
router.use("/kontakt", requirePermission(PERMISSION.MANAGE_MARKETING), contactRoutes);
router.use("/kuponi", requirePermission(PERMISSION.MANAGE_COUPONS), couponRoutes);
router.use("/newsletter", requirePermission(PERMISSION.MANAGE_MARKETING), newsletterRoutes);
// campaign.routes.js existed and was fully wired (controller/validator/views all
// reference /admin/newsletter/kampanje/... - see campaign.presenter.js's sendUrl and
// campaign-send-form.ejs) but was never actually mounted here, so every campaign
// create/edit/send URL in the newsletter section 404'd. Found while tracing call
// sites for the POST->PUT conversion below - mounted at the path the presenter/views
// already assumed.
router.use("/newsletter/kampanje", requirePermission(PERMISSION.MANAGE_MARKETING), campaignRoutes);
router.use("/testimoniali", requirePermission(PERMISSION.MANAGE_MARKETING), testimonialRoutes);
router.use("/saradnici", requirePermission(PERMISSION.MANAGE_MARKETING), businessPartnerRoutes);
router.use("/proizvodi", requirePermission(PERMISSION.MANAGE_PRODUCTS), productRoutes);
router.use("/porudzbine", requirePermission(PERMISSION.MANAGE_ORDERS), orderRoutes);
router.use("/privremene-porudzbine", requirePermission(PERMISSION.MANAGE_ORDERS), temporaryOrderRoutes);
router.use("/sajt", requirePermission(PERMISSION.MANAGE_SITE_CONTENT), siteSettingsRoutes);

export default router;