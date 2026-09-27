import { Router } from "express";
import * as AdminOpsController from "../../../controllers/api/v1/admin-ops.controller.js";
import { validateDirectPayoutRecord } from "../../../middlewares/validators/payout-request.validator.js";
import { validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";
import { mongoIdParamValidator } from "../../../middlewares/validators/helpers/common.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { validateWorkingHoursUpdate, validateClosedDatesUpdate } from "../../../middlewares/validators/site-settings.validator.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";

const validateRequestId = mongoIdParamValidator("requestId", "zahteva");

const router = Router();
router.use(apiAuthMiddleware, requirePermission(PERMISSION.ACCESS_ADMIN_PANEL));

router.get("/dashboard", AdminOpsController.dashboard);

// ---- Payouts ----
// approve/pay/reject take only an optional free-text "reason" (see
// payout-request.controller.js's web version - no express-validator chain there
// either, just `req.body.reason || ""`), so no body validator is chained here.
router.get("/payout-requests", requirePermission(PERMISSION.MANAGE_PAYOUTS), AdminOpsController.listPayoutRequests);
router.get("/payout-requests/:requestId", requirePermission(PERMISSION.MANAGE_PAYOUTS), validateRequestId, handleApiValidationErrors, AdminOpsController.getPayoutRequest);
router.post("/payout-requests/direct", requirePermission(PERMISSION.MANAGE_PAYOUTS), validateDirectPayoutRecord, handleApiValidationErrors, AdminOpsController.recordPayoutDirectly);
router.put("/payout-requests/:requestId/approve", requirePermission(PERMISSION.MANAGE_PAYOUTS), validateRequestId, handleApiValidationErrors, AdminOpsController.approvePayoutRequest);
router.put("/payout-requests/:requestId/pay", requirePermission(PERMISSION.MANAGE_PAYOUTS), validateRequestId, handleApiValidationErrors, AdminOpsController.markPayoutRequestPaid);
router.put("/payout-requests/:requestId/reject", requirePermission(PERMISSION.MANAGE_PAYOUTS), validateRequestId, handleApiValidationErrors, AdminOpsController.rejectPayoutRequest);

// ---- Audit log ----
router.get("/audit-log", requirePermission(PERMISSION.VIEW_LOGS), AdminOpsController.listAuditLogs);

// ---- Log summaries ----
router.get("/logs", requirePermission(PERMISSION.VIEW_LOGS), AdminOpsController.getLogDashboard);
router.get("/logs/history", requirePermission(PERMISSION.VIEW_LOGS), AdminOpsController.listLogSummaries);
router.get("/logs/history/:date", requirePermission(PERMISSION.VIEW_LOGS), AdminOpsController.getLogSummary);

// ---- Business reports ----
router.get("/business-reports", requirePermission(PERMISSION.VIEW_BUSINESS_REPORTS), AdminOpsController.getBusinessReportDashboard);
router.get("/business-reports/history/:periodType", requirePermission(PERMISSION.VIEW_BUSINESS_REPORTS), AdminOpsController.listBusinessReports);
router.get("/business-reports/history/:periodType/:periodKey", requirePermission(PERMISSION.VIEW_BUSINESS_REPORTS), AdminOpsController.getBusinessReport);

// ---- Site settings ----
router.get("/site-settings", requirePermission(PERMISSION.MANAGE_SITE_CONTENT), AdminOpsController.getSiteSettings);
router.put("/site-settings", requirePermission(PERMISSION.MANAGE_SITE_CONTENT), AdminOpsController.updateSiteSettings);
router.put(
  "/site-settings/radno-vreme",
  requirePermission(PERMISSION.MANAGE_SITE_CONTENT),
  validateWorkingHoursUpdate,
  handleApiValidationErrors,
  AdminOpsController.updateWorkingHours
);
router.put(
  "/site-settings/neradni-dani",
  requirePermission(PERMISSION.MANAGE_SITE_CONTENT),
  validateClosedDatesUpdate,
  handleApiValidationErrors,
  AdminOpsController.updateClosedDates
);

// ---- Admin's own profile (just access_admin_panel, already required by the whole router) ----
router.get("/profile", AdminOpsController.getProfile);
router.put("/profile", validateProfileUpdate, handleApiValidationErrors, AdminOpsController.updateProfile);

export default router;
