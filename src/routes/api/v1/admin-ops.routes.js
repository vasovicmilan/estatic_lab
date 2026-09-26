import { Router } from "express";
import * as AdminOpsController from "../../../controllers/api/v1/admin-ops.controller.js";
import { validateDirectPayoutRecord } from "../../../middlewares/validators/payout-request.validator.js";
import { validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";
import { mongoIdParamValidator } from "../../../middlewares/validators/helpers/common.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { validateWorkingHoursUpdate, validateClosedDatesUpdate } from "../../../middlewares/validators/site-settings.validator.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

const validateRequestId = mongoIdParamValidator("requestId", "zahteva");

const router = Router();
router.use(apiAuthMiddleware, requirePermission("access_admin_panel"));

router.get("/dashboard", AdminOpsController.dashboard);

// ---- Payouts ----
// approve/pay/reject take only an optional free-text "reason" (see
// payout-request.controller.js's web version - no express-validator chain there
// either, just `req.body.reason || ""`), so no body validator is chained here.
router.get("/payout-requests", requirePermission("manage_payouts"), AdminOpsController.listPayoutRequests);
router.get("/payout-requests/:requestId", requirePermission("manage_payouts"), validateRequestId, handleApiValidationErrors, AdminOpsController.getPayoutRequest);
router.post("/payout-requests/direct", requirePermission("manage_payouts"), validateDirectPayoutRecord, handleApiValidationErrors, AdminOpsController.recordPayoutDirectly);
router.put("/payout-requests/:requestId/approve", requirePermission("manage_payouts"), validateRequestId, handleApiValidationErrors, AdminOpsController.approvePayoutRequest);
router.put("/payout-requests/:requestId/pay", requirePermission("manage_payouts"), validateRequestId, handleApiValidationErrors, AdminOpsController.markPayoutRequestPaid);
router.put("/payout-requests/:requestId/reject", requirePermission("manage_payouts"), validateRequestId, handleApiValidationErrors, AdminOpsController.rejectPayoutRequest);

// ---- Audit log ----
router.get("/audit-log", requirePermission("view_logs"), AdminOpsController.listAuditLogs);

// ---- Log summaries ----
router.get("/logs", requirePermission("view_logs"), AdminOpsController.getLogDashboard);
router.get("/logs/history", requirePermission("view_logs"), AdminOpsController.listLogSummaries);
router.get("/logs/history/:date", requirePermission("view_logs"), AdminOpsController.getLogSummary);

// ---- Business reports ----
router.get("/business-reports", requirePermission("view_business_reports"), AdminOpsController.getBusinessReportDashboard);
router.get("/business-reports/history/:periodType", requirePermission("view_business_reports"), AdminOpsController.listBusinessReports);
router.get("/business-reports/history/:periodType/:periodKey", requirePermission("view_business_reports"), AdminOpsController.getBusinessReport);

// ---- Site settings ----
router.get("/site-settings", requirePermission("manage_site_content"), AdminOpsController.getSiteSettings);
router.put("/site-settings", requirePermission("manage_site_content"), AdminOpsController.updateSiteSettings);
router.put(
  "/site-settings/radno-vreme",
  requirePermission("manage_site_content"),
  validateWorkingHoursUpdate,
  handleApiValidationErrors,
  AdminOpsController.updateWorkingHours
);
router.put(
  "/site-settings/neradni-dani",
  requirePermission("manage_site_content"),
  validateClosedDatesUpdate,
  handleApiValidationErrors,
  AdminOpsController.updateClosedDates
);

// ---- Admin's own profile (just access_admin_panel, already required by the whole router) ----
router.get("/profile", AdminOpsController.getProfile);
router.put("/profile", validateProfileUpdate, handleApiValidationErrors, AdminOpsController.updateProfile);

export default router;
