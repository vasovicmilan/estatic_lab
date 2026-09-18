import { Router } from "express";
import authRoutes from "./auth.routes.js";
import catalogRoutes from "./catalog.routes.js";
import bookingRoutes from "./booking.routes.js";
import cartRoutes from "./cart.routes.js";
import meRoutes from "./me.routes.js";
import employeeRoutes from "./employee.routes.js";
import partnerRoutes from "./partner.routes.js";
import adminTaxonomyRoutes from "./admin-taxonomy.routes.js";
import adminPeopleRoutes from "./admin-people.routes.js";
import adminAppointmentRoutes from "./admin-appointment.routes.js";
import adminOrderRoutes from "./admin-order.routes.js";
import adminCatalogRoutes from "./admin-catalog.routes.js";
import adminPackagePurchaseRoutes from "./admin-package-purchase.routes.js";
import adminMarketingRoutes from "./admin-marketing.routes.js";
import adminOpsRoutes from "./admin-ops.routes.js";

const router = Router();

// Mounted under /api/v1 by routes/index.routes.js. Folder-per-version (not just a
// URL-prefix variable) is deliberate: when v2 someday needs to change a wire
// contract, that file gets copied into routes/api/v2/ and edited there - v1 stays
// physically untouched, so it can't be broken by an edit meant for v2. Everything
// below is thin routing/wiring only - all business logic lives in services/, shared
// unversioned, exactly as it already does for the web app.
router.use("/auth", authRoutes);
router.use("/booking", bookingRoutes);
router.use("/me", meRoutes);
router.use("/employee", employeeRoutes);
router.use("/partner", partnerRoutes);
router.use("/admin", adminTaxonomyRoutes);
router.use("/admin", adminPeopleRoutes);
router.use("/admin/appointments", adminAppointmentRoutes);
router.use("/admin", adminOrderRoutes);
router.use("/admin", adminCatalogRoutes);
router.use("/admin/package-purchases", adminPackagePurchaseRoutes);
router.use("/admin", adminMarketingRoutes);
router.use("/admin", adminOpsRoutes);
router.use("/", cartRoutes);
router.use("/", catalogRoutes);

export default router;
