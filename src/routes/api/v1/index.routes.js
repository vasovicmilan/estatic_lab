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
import adminUploadsRoutes from "./admin-uploads.routes.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();

// Mounted under /api/v1 by routes/index.routes.js. Folder-per-version (not just a
// URL-prefix variable) is deliberate: when v2 someday needs to change a wire
// contract, that file gets copied into routes/api/v2/ and edited there - v1 stays
// physically untouched, so it can't be broken by an edit meant for v2. Everything
// below is thin routing/wiring only - all business logic lives in services/, shared
// unversioned, exactly as it already does for the web app.
//
// requireModule() gating below covers mounts where the WHOLE file is
// single-module (booking.routes.js, employee.routes.js, partner.routes.js,
// cart.routes.js, admin-appointment.routes.js, admin-order.routes.js,
// admin-package-purchase.routes.js) - simplest and clearest right on the
// mount. catalog.routes.js, admin-catalog.routes.js, admin-marketing.routes.js,
// admin-taxonomy.routes.js, admin-people.routes.js and admin-uploads.routes.js
// are NOT gated here, on purpose - each of those files mixes resources from
// more than one module in a single router (e.g. admin-catalog.routes.js serves
// services/packages AND products), so gating the whole mount would incorrectly
// hide a module that IS enabled just because a different resource in the same
// file belongs to a disabled one. Those instead gate each ROUTE individually,
// inline, the exact same way requirePermission() is already applied per-route
// in those files - see the "---- <Section> ----" comment blocks inside each
// one (admin-uploads.routes.js does this via its own requireUploadModule,
// keyed by the :type in the URL rather than a fixed section of the file).
router.use("/auth", authRoutes);
router.use("/booking", requireModule("booking"), bookingRoutes);
router.use("/me", meRoutes);
router.use("/employee", requireModule("employees"), employeeRoutes);
router.use("/partner", requireModule("partners"), partnerRoutes);
router.use("/admin", adminTaxonomyRoutes);
router.use("/admin", adminPeopleRoutes);
router.use("/admin/appointments", requireModule("booking"), adminAppointmentRoutes);
router.use("/admin", requireModule("shop"), adminOrderRoutes);
router.use("/admin", adminCatalogRoutes);
router.use("/admin/package-purchases", requireModule("booking"), adminPackagePurchaseRoutes);
router.use("/admin", adminMarketingRoutes);
router.use("/admin", adminOpsRoutes);
router.use("/admin", adminUploadsRoutes);
router.use("/", requireModule("shop"), cartRoutes);
router.use("/", catalogRoutes);

export default router;
