import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { adminLimiter } from "../../middlewares/rate-limiter.middleware.js";

import * as DashboardController from "../../controllers/web/admin/dashboard.controller.js";
import roleRoutes from "./admin/role.routes.js";
import userRoutes from "./admin/user.routes.js";
import profileRoutes from "./admin/profile.routes.js";
import employeeRoutes from "./admin/employee.routes.js";
import expertRoutes from "./admin/expert.routes.js";
import categoryRoutes from "./admin/category.routes.js";
import tagRoutes from "./admin/tag.routes.js";
import serviceRoutes from "./admin/service.routes.js";
import packageRoutes from "./admin/package.routes.js";
import packagePurchaseRoutes from "./admin/package-purchase.routes.js";
import appointmentRoutes from "./admin/appointment.routes.js";
import postRoutes from "./admin/post.routes.js";
import contactRoutes from "./admin/contact.routes.js";
import couponRoutes from "./admin/coupon.routes.js";
import newsletterRoutes from "./admin/news-letter.routes.js";
import testimonialRoutes from "./admin/testimonial.routes.js";

const router = Router();

router.use(adminMiddleware);
router.use(adminLimiter);

router.get("/", DashboardController.dashboard);

router.use("/role", requirePermission("manage_roles"), roleRoutes);
router.use("/korisnici", requirePermission("manage_users"), userRoutes);
router.use("/profil", profileRoutes);
router.use("/zaposleni", requirePermission("manage_employees"), employeeRoutes);
router.use("/eksperti", requirePermission("manage_employees"), expertRoutes);
router.use("/kategorije", requirePermission("manage_taxonomy"), categoryRoutes);
router.use("/tagovi", requirePermission("manage_taxonomy"), tagRoutes);
router.use("/usluge", requirePermission("manage_services"), serviceRoutes);
router.use("/paketi", requirePermission("manage_packages"), packageRoutes);
router.use("/kupljeni-paketi", requirePermission("manage_packages"), packagePurchaseRoutes);
router.use("/termini", requirePermission("manage_appointments_all"), appointmentRoutes);
router.use("/blog", requirePermission("manage_blog"), postRoutes);
router.use("/kontakt", requirePermission("manage_marketing"), contactRoutes);
router.use("/kuponi", requirePermission("manage_coupons"), couponRoutes);
router.use("/newsletter", requirePermission("manage_marketing"), newsletterRoutes);
router.use("/testimoniali", requirePermission("manage_marketing"), testimonialRoutes);

export default router;