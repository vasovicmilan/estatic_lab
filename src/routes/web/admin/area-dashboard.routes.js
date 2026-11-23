import { Router } from "express";
import { requirePermission, requireAnyPermission } from "../../../middlewares/permission.middleware.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";
import * as AreaDashboardController from "../../../controllers/web/admin/area-dashboard.controller.js";

const router = Router();

router.get("/blog", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), AreaDashboardController.blogDashboard);
router.get("/prodavnica", requireModule("shop"), requirePermission(PERMISSION.MANAGE_PRODUCTS), AreaDashboardController.shopDashboard);
router.get(
  "/katalog",
  requireModule("booking"),
  requireAnyPermission(PERMISSION.MANAGE_SERVICES, PERMISSION.MANAGE_PACKAGES),
  AreaDashboardController.catalogDashboard
);

export default router;
