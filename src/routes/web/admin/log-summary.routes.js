import { Router } from "express";
import * as LogSummaryController from "../../../controllers/web/admin/logs/log-summary.controller.js";
import * as AuditLogController from "../../../controllers/web/admin/logs/audit-log.controller.js";

const router = Router();

router.get("/", LogSummaryController.logDashboard);
router.get("/istorija", LogSummaryController.logHistoryList);
router.get("/audit", AuditLogController.auditLogList);
router.get("/istorija/:date", LogSummaryController.logSummaryDetail);

export default router;