import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
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

router.use("/role", requirePermission("manage_roles"), roleRoutes);
router.use("/korisnici", requirePermission("manage_users"), userRoutes);
router.use("/profil", profileRoutes);
router.use("/zaposleni", requirePermission("manage_employees"), employeeRoutes);
router.use("/partneri", requirePermission("manage_partners"), partnerRoutes);
router.use("/isplate", requirePermission("manage_payouts"), payoutRequestRoutes);
router.use("/logovi", requirePermission("view_logs"), logSummaryRoutes);
router.use("/poslovni-izvestaji", requirePermission("view_business_reports"), businessReportRoutes);
router.use("/eksperti", requirePermission("manage_employees"), expertRoutes);
router.use("/kategorije", requirePermission("manage_taxonomy"), categoryRoutes);
router.use("/tagovi", requirePermission("manage_taxonomy"), tagRoutes);
router.use("/resursi", requirePermission("manage_resources"), resourceRoutes);
router.use("/usluge", requirePermission("manage_services"), serviceRoutes);
router.use("/paketi", requirePermission("manage_packages"), packageRoutes);
router.use("/kupljeni-paketi", requirePermission("manage_packages"), packagePurchaseRoutes);
router.use("/termini", requirePermission("manage_appointments_all"), appointmentRoutes);
router.use("/blog", requirePermission("manage_blog"), postRoutes);
router.use("/kontakt", requirePermission("manage_marketing"), contactRoutes);
router.use("/kuponi", requirePermission("manage_coupons"), couponRoutes);
router.use("/newsletter", requirePermission("manage_marketing"), newsletterRoutes);
// campaign.routes.js existed and was fully wired (controller/validator/views all
// reference /admin/newsletter/kampanje/... - see campaign.presenter.js's sendUrl and
// campaign-send-form.ejs) but was never actually mounted here, so every campaign
// create/edit/send URL in the newsletter section 404'd. Found while tracing call
// sites for the POST->PUT conversion below - mounted at the path the presenter/views
// already assumed.
router.use("/newsletter/kampanje", requirePermission("manage_marketing"), campaignRoutes);
router.use("/testimoniali", requirePermission("manage_marketing"), testimonialRoutes);
router.use("/saradnici", requirePermission("manage_marketing"), businessPartnerRoutes);
router.use("/proizvodi", requirePermission("manage_products"), productRoutes);
router.use("/porudzbine", requirePermission("manage_orders"), orderRoutes);
router.use("/privremene-porudzbine", requirePermission("manage_orders"), temporaryOrderRoutes);
router.use("/sajt", requirePermission("manage_site_content"), siteSettingsRoutes);

export default router;