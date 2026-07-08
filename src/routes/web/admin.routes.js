import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin.middleware.js";
import { adminLimiter } from "../../middlewares/rate-limiter.middleware.js";

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

router.use("/role", roleRoutes);
router.use("/korisnici", userRoutes);
router.use("/profil", profileRoutes);
router.use("/zaposleni", employeeRoutes);
router.use("/eksperti", expertRoutes);
router.use("/kategorije", categoryRoutes);
router.use("/tagovi", tagRoutes);
router.use("/usluge", serviceRoutes);
router.use("/paketi", packageRoutes);
router.use("/kupljeni-paketi", packagePurchaseRoutes);
router.use("/termini", appointmentRoutes);
router.use("/blog", postRoutes);
router.use("/kontakt", contactRoutes);
router.use("/kuponi", couponRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/testimoniali", testimonialRoutes);

export default router;
